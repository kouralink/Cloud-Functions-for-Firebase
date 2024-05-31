import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// Trigger for updates on notifications
export const onNotificationUpdate = functions.firestore
  .document("/notifications/{notificationId}")
  .onUpdate(async (change) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if the 'action' field was updated for the first time from null
    // to one of the allowed values
    if (
      !beforeData.action &&
      ["accept", "decline", "views"].includes(afterData.action)
    ) {
      const action = afterData.action;
      const type = afterData.type;

      if (action === "accept" && type === "request_to_join_team") {
        const userId = afterData.from_id;
        const teamId = afterData.to_id;
        // Check user account type should be player
        const userDoc = await db.collection("/users").doc(userId).get();
        if (!userDoc.exists || userDoc.data()?.accountType !== "player") {
          return;
        }

        // Check if user is already in the team
        const memberDoc = await db
          .collection(`/teams/${teamId}/members`)
          .doc(userId)
          .get();
        if (memberDoc.exists) {
          return;
        }

        // Add the user to the team
        await db.collection(`/teams/${teamId}/members`).doc(userId).set({
          team_id: teamId,
          uid: userId,
          role: "member",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (action === "accept" && type === "invite_to_team") {
        const teamId = afterData.from_id;
        const userId = afterData.to_id;
        // Check user account type should be player
        const userDoc = await db.collection("/users").doc(userId).get();
        if (!userDoc.exists || userDoc.data()?.accountType !== "player") {
          return;
        }
        // Check if user is already in the team
        const memberDoc = await db
          .collection(`/teams/${teamId}/members`)
          .doc(userId)
          .get();
        if (memberDoc.exists) {
          return;
        }

        // Add the user to the team
        await db.collection(`/teams/${teamId}/members`).doc(userId).set({
          team_id: teamId,
          uid: userId,
          role: "member",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  });

interface Member {
  uid: string;
  joinedAt: string;
  teamid: string;
  role: "coach" | "member";
}
export const onMemberChange = functions.firestore
  .document("/teams/{teamId}/members/{memberId}")
  .onWrite(async (change, context) => {
    const teamId = context.params.teamId;
    const memberId = context.params.memberId;
    //  oMD = old member data, nMData = new member data
    const nMData = change.after.exists ? (change.after.data() as Member) : null;
    const oMD = change.before.exists ? (change.before.data() as Member) : null;

    if (nMData && !oMD) {
      // Member added
      await handleMemberAdded(teamId, memberId, nMData);
    } else if (!nMData && oMD) {
      // Member removed
      await handleMemberRemoved(teamId, memberId);
    }
  });

/**
 * Handles the addition of a team member.
 *
 * @param {string} teamId - The ID of the team.
 * @param {string} memberId - The ID of the member.
 * @param {Member} memberData - The data of the member.
 * @return {Promise<void>} - A promise that resolves when
 * the operation is complete.
 * */
async function handleMemberAdded(
  teamId: string,
  memberId: string,
  memberData: Member
) {
  const userDoc = await db.collection("users").doc(memberId).get();
  if (!userDoc.exists) {
    console.log(`User with ID ${memberId} not found.`);
    return;
  }

  const userData = userDoc.data();
  const role = memberData.role;

  if (
    (role === "member" && userData?.accountType !== "player") ||
    (role === "coach" && userData?.accountType !== "coach")
  ) {
    console.log(
      `User with ID ${memberId} has incorrect account type for role ${role}.`
    );
    return;
  }

  // Send notifications to all team members
  const membersSnapshot = await db.collection(`/teams/${teamId}/members`).get();
  membersSnapshot.forEach(async (member) => {
    const notification = {
      from_id: teamId,
      to_id: member.id,
      title: "New Team Member Joined",
      message: `${(userDoc.exists && userDoc.data()?.username) || "A"}
      new ${role} has joined the team.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification);
  });
}

/**
 * Handles the removal of a team member.
 *
 * @param {string} teamId - The ID of the team.
 * @param {string} memberId - The ID of the member.
 * @return {Promise<void>} - A promise that resolves when
 * the operation is complete.
 * */
async function handleMemberRemoved(teamId: string, memberId: string) {
  // Send notifications to all team members
  const userDoc = await db.collection("users").doc(memberId).get();
  const membersSnapshot = await db.collection(`/teams/${teamId}/members`).get();
  membersSnapshot.forEach(async (member) => {
    const notification = {
      from_id: teamId,
      to_id: member.id,
      title: "Team Member Removed",
      message: `${(userDoc.exists && userDoc.data()?.username) || "A"} 
      member has been removed from the team.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification);
  });
}

interface ChangeCoachData {
  coachid: string;
  memberid: string;
  teamid: string;
}

exports.changeCoach = functions.https.onCall(async (data: ChangeCoachData) => {
  const {coachid, memberid, teamid} = data;

  if (!coachid || !memberid || !teamid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require (coachid,memberid,teamid) parameters."
    );
  }

  if (coachid === memberid) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The coachid and memberid must be different."
    );
  }

  try {
    // Check if the coach exists and has the role of "coach"
    const coachDoc = await db
      .collection("teams")
      .doc(teamid)
      .collection("members")
      .doc(coachid)
      .get();
    if (!coachDoc.exists || coachDoc.data()?.role !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified coach does not exist or is not a coach."
      );
    }

    // Check if the member exists
    const memberDoc = await db
      .collection("teams")
      .doc(teamid)
      .collection("members")
      .doc(memberid)
      .get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified member does not exist."
      );
    }

    // Update roles in the team members collection
    await db
      .collection("teams")
      .doc(teamid)
      .collection("members")
      .doc(coachid)
      .update({role: "member"});
    await db
      .collection("teams")
      .doc(teamid)
      .collection("members")
      .doc(memberid)
      .update({role: "coach"});

    // Update account types in the users collection
    await db.collection("users").doc(coachid).update({accountType: "player"});
    await db.collection("users").doc(memberid).update({accountType: "coach"});

    return {success: true};
  } catch (error) {
    console.error("Error updating roles: ", error);
    throw new functions.https.HttpsError(
      "unknown",
      "An error occurred while updating roles."
    );
  }
});
