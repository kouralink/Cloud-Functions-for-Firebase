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

export const onMemberUpdate = functions.firestore
  .document("/teams/{teamId}/members/{memberId}")
  .onWrite(async (change, context) => {
    const teamId = context.params.teamId;
    const memberId = context.params.memberId;

    const memberDoc = change.after.exists ? change.after.data() : null;
    const prevMemberDoc = change.before.exists ? change.before.data() : null;

    if (memberDoc && !prevMemberDoc) {
      // Member added
      await handleMemberAdded(teamId, memberId, memberDoc);
    } else if (!memberDoc && prevMemberDoc) {
      // Member deleted
      await handleMemberDeleted(teamId, memberId);
    }
  });

interface Member {
  uid: string;
  joinedAt: string;
  team_id: string;
  role: "coach" | "member";
}
export const onMemberChange = functions.firestore
  .document("/teams/{teamId}/members/{memberId}")
  .onWrite(async (change, context) => {
    const teamId = context.params.teamId;
    const memberId = context.params.memberId;

    const newMemberData = change.after.exists
      ? (change.after.data() as Member)
      : null;
    const oldMemberData = change.before.exists
      ? (change.before.data() as Member)
      : null;

    if (newMemberData && !oldMemberData) {
      // Member added
      await handleMemberAdded(teamId, memberId, newMemberData);
    } else if (!newMemberData && oldMemberData) {
      // Member removed
      await handleMemberRemoved(teamId, memberId);
    }
  });

/**
 * Handles the addition of a team member.
 *
 * @param teamId - The ID of the team.
 * @param memberId - The ID of the member.
 * @param memberData - The data of the member (can be null).
 */
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
      title: "New Team Member Added",
      message: `A new ${role} has joined the team.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification);
  });
}

async function handleMemberRemoved(teamId: string, memberId: string) {
  // Send notifications to all team members
  const membersSnapshot = await db.collection(`/teams/${teamId}/members`).get();
  membersSnapshot.forEach(async (member) => {
    const notification = {
      from_id: teamId,
      to_id: member.id,
      title: "Team Member Removed",
      message: `A member has been removed from the team.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification);
  });
}
