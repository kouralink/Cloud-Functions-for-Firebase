import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
admin.initializeApp();

const db = admin.firestore();
export type Action = "accept" | "decline" | "view";
type NotificationType = "info"
| "request_to_join_team"
| "request_to_join_tournement"
| "match_chalenge"
| "invite_to_team"
| "invite_to_tournement";

interface NotificationFireStore {
  from_id: string;
  to_id: string;
  title: string;
  message: string;
  createdAt: Timestamp;
  action: Action | null;
  type: NotificationType;
}
interface Notification extends NotificationFireStore{
  id: string;
}

export interface TeamMatch {
  id: string;
  score: number | null;
  isAgreed: boolean;
}
export interface Match {
  id: string;
  team1: TeamMatch;
  team2: TeamMatch;
  referee_id: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startIn: Timestamp|null;
  endedAt: Timestamp|null;
  location: string | null;
  status: "pending" | "finish" | "cancled";
  type: "tournement" | "classic_match";
}

export interface User {
  username: string;
  accountType: "user" | "coach" | "tournement_manager" | "refree" | "player";
  bio?: string;
  birthday?: Timestamp;
  joinDate?: Timestamp;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  phoneNumbers?: string[];
  address?: string;
  avatar?: string;
}

export interface Team {
  id: string;
  teamName: string;
  blackList?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  teamLogo: string;
  description: string;
  createdBy: string;
}

// Trigger for updates on notifications
export const onNotificationUpdate = functions.firestore
  .document("/notifications/{notificationId}")
  .onUpdate(async (change) => {
    const beforeData = {
      ...change.before.data(),
      id: change.after.id} as Notification;
    const afterData = {...change.after.data(),
      id: change.after.id} as Notification;

    // Check if the 'action' field was updated for the first time from null
    // to one of the allowed values
    if (
      !beforeData.action &&
      afterData.action === "accept") {
      const type = afterData.type;

      if (type === "request_to_join_team") {
        const userId = afterData.from_id;
        const teamId = afterData.to_id;
        // Check user account type should be player
        const userDoc = await db.collection("/users").doc(userId).get();

        if (!userDoc.exists) {
          return;
        }
        const userData = userDoc.data() as User;
        // get team data
        const teamDoc = await db.collection("teams").doc(teamId).get();
        if (!teamDoc.exists) {
          return;
        }
        const teamData = teamDoc.data() as Team;
        if (userData?.accountType !== "player") {
          // send notification to the user that the request has been declined
          const notification: NotificationFireStore = {
            from_id: teamId,
            to_id: userId,
            title: "Request Declined",
            message:
            // eslint-disable-next-line max-len
            `You can't join the team ${teamData.teamName} because your account type is not player.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);

          // send notification to the team that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: userId,
            to_id: teamId,
            title: "Request Declined",
            message:
            // eslint-disable-next-line max-len
            `${userData.username} can't join the team because his account type is not player.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);

          return;
        }
        // check if user is already in a team using collectionGroup
        const userTeams = await db.collectionGroup("members")
          .where("uid", "==", userId)
          .get();
        if (!userTeams.empty) {
          // send notification to the user that the request has been declined
          const notification: NotificationFireStore = {
            from_id: teamId,
            to_id: userId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `You can't join the team ${teamData.teamName} because you are already in a team.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);

          // send notification to the team that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: userId,
            to_id: teamId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `${userData.username} can't join the team because he is already in a team.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);

          return;
        }

        // check if user in the team blackList
        if (teamData.blackList?.includes(userId)) {
          // send notification to the user that the request has been declined
          const notification: NotificationFireStore = {
            from_id: teamId,
            to_id: userId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `You can't join the team ${teamData.teamName} because you are in the team blackList.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);

          // send notification to the team that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: userId,
            to_id: teamId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `${userData.username} can't join the team because he is in the team blackList.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);

          return;
        }

        // Add the user to the team
        await db.collection(`/teams/${teamId}/members`).doc(userId).set({
          team_id: teamId,
          uid: userId,
          role: "member",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (type === "invite_to_team") {
        const teamId = afterData.from_id;
        const userId = afterData.to_id;
        // Check user account type should be player
        const userDoc = await db.collection("/users").doc(userId).get();
        if (!userDoc.exists) {
          return;
        }
        const userData = userDoc.data() as User;
        // get team data
        const teamDoc = await db.collection("teams").doc(teamId).get();
        if (!teamDoc.exists) {
          return;
        }
        const teamData = teamDoc.data() as Team;
        if (userData?.accountType !== "player") {
          // send notification to the user that the request has been declined
          const notification: NotificationFireStore = {
            from_id: teamId,
            to_id: userId,
            title: "Invite Declined",
            message:
            // eslint-disable-next-line max-len
            `You can't join the team ${teamData.teamName} because your account type is not player.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);

          // send notification to the team that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: userId,
            to_id: teamId,
            title: "Invite Declined",
            message:
            // eslint-disable-next-line max-len
            `${userData.username} can't join the team because his account type is not player.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);

          return;
        }
        // check if user is already in a team using collectionGroup
        const userTeams = await db.collectionGroup("members")
          .where("uid", "==", userId)
          .get();
        if (!userTeams.empty) {
          // send notification to the user that the request has been declined
          const notification: NotificationFireStore = {
            from_id: teamId,
            to_id: userId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `You can't join the team ${teamData.teamName} because you are already in a team.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);

          // send notification to the team that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: userId,
            to_id: teamId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `${userData.username} can't join the team because he is already in a team.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);

          return;
        }

        // check if user in the team blackList
        if (teamData.blackList?.includes(userId)) {
          // send notification to the user that the request has been declined
          const notification: NotificationFireStore = {
            from_id: teamId,
            to_id: userId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `You can't join the team ${teamData.teamName} because you are in the team blackList.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);

          // send notification to the team that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: userId,
            to_id: teamId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `${userData.username} can't join the team because he is in the team blackList.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);

          return;
        }

        // Add the user to the team
        await db.collection(`/teams/${teamId}/members`).doc(userId).set({
          team_id: teamId,
          uid: userId,
          role: "member",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (type === "match_chalenge") {
        const fromId = afterData.from_id; // Team ID
        const toId = afterData.to_id; // Team ID
        // check if fromId and toId are the same
        if (fromId === toId) {
          // send notification to the team that the challenge request
          // has been declined
          const notification: NotificationFireStore = {
            from_id: toId,
            to_id: fromId,
            title: "Match Challenge Declined",
            message: "You can't challenge your own team.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          return;
        }
        // create a match document
        const matchId = afterData.id;
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (matchDoc.exists) {
          return;
        }
        // get team1 data
        const team1Doc = await db.collection("teams").doc(fromId).get();
        // get team2 data
        const team2Doc = await db.collection("teams").doc(toId).get();
        if (!team1Doc.exists) {
          // send notification to the team that the challenge request
          // has been declined because the challenger team does not exist
          const notification: NotificationFireStore = {
            from_id: toId,
            to_id: toId,
            title: "Match Challenge Declined",
            message: "The challenger team does not exist.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          return;
        }
        if (!team2Doc.exists) {
          // send notification to the team that the challenge request
          // has been declined because the challenged team does not exist
          const notification: NotificationFireStore = {
            from_id: fromId,
            to_id: fromId,
            title: "Match Challenge Declined",
            message: "The Request Does Not Complete. Please Try Again.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          return;
        }
        // create a match document
        const matchData: Match = {
          id: matchId,
          team1: {id: fromId, score: null, isAgreed: false},
          team2: {id: toId, score: null, isAgreed: false},
          referee_id: null,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          startIn: null,
          endedAt: null,
          location: null,
          status: "pending",
          type: "classic_match",
        };
        await db.collection("matches").doc(matchId).set(matchData);

        // Send notifications to challenger team that
        // the challenge request has been accepted
        const notification1: NotificationFireStore = {
          from_id: toId,
          to_id: fromId,
          title: "Match Challenge Accepted",
          message: `${team2Doc.data()?.teamName}
          has accepted your match challenge.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification1);
        // send notification to challenged team that
        // the match has been created
        const notification2: NotificationFireStore = {
          from_id: fromId,
          to_id: toId,
          title: "Match Created",
          message: `${team1Doc.data()?.teamName}
          has created a match.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification2);
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

    // get member user data from users collection
    const memberUserDoc = await db.collection("users").doc(memberid).get();
    if (!memberUserDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified member user does not exist."
      );
    }
    const memberUserData = memberUserDoc.data() as User;

    // get coach user data from users collection
    const coachUserDoc = await db.collection("users").doc(coachid).get();
    if (!coachUserDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified coach user does not exist."
      );
    }
    const coachUserData = coachUserDoc.data() as User;

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

    // send notification to the coach that the role has been changed
    const notification1: NotificationFireStore = {
      from_id: teamid,
      to_id: coachid,
      title: "Role Changed",
      message: "Your role has been changed to member.",
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification1);

    // send notification to the member that the role has been changed
    const notification2: NotificationFireStore = {
      from_id: teamid,
      to_id: memberid,
      title: "Role Changed",
      message: "Your role has been changed to coach.",
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification2);

    // send notification to all team members
    const membersSnapshot = await db
      .collection(`/teams/${teamid}/members`)
      .get();

    membersSnapshot.forEach(async (member) => {
      const notification = {
        from_id: teamid,
        to_id: member.id,
        title: "Role Changed",
        // eslint-disable-next-line max-len
        message: `The roles of ${coachUserData.username} and ${memberUserData.username} have been changed, the new coach is ${memberUserData.username}.`,
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification);
    });

    return {success: true};
  } catch (error) {
    console.error("Error updating roles: ", error);
    throw new functions.https.HttpsError(
      "unknown",
      "An error occurred while updating roles."
    );
  }
});
