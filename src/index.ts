/* eslint-disable max-len */
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
| "refree_invite"
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
export type MatchStatus =
  | "coachs_edit"
  | "refree_waiting"
  | "pending"
  | "in_progress"
  | "finish"
  | "cancled";
export interface Match {
  id: string;
  team1: TeamMatch;
  team2: TeamMatch;
  refree:{
    id:string|null;
    isAgreed:boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startIn: Timestamp|null;
  endedAt: Timestamp|null;
  location: string | null;
  status: MatchStatus;
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
      !beforeData.action) {
      const type = afterData.type;

      if (type === "request_to_join_team" && afterData.action === "accept") {
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
      } else if (type === "invite_to_team" && afterData.action === "accept") {
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
      } else if (type === "match_chalenge" && afterData.action === "accept") {
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
          refree: {
            id: null,
            isAgreed: false,
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          startIn: null,
          endedAt: null,
          location: null,
          status: "coachs_edit",
          type: "classic_match",
        };
        await db.collection("matches").doc(matchId).set(matchData);

        // Send notifications to challenger team that
        // the challenge request has been accepted
        const notification1: NotificationFireStore = {
          from_id: toId,
          to_id: fromId,
          title: "Match Challenge Accepted",
          message: `${team2Doc.data()?.teamName} Team
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
          message: `The match with Team ${team1Doc.data()?.teamName}
          has been created.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification2);
      } else if (type === "refree_invite") {
        const matchId = afterData.from_id;
        const refreeId = afterData.to_id;
        // check if refreeId is refree
        const refreeDoc = await db.collection("users").doc(refreeId).get();
        if (!refreeDoc.exists) {
          return;
        }
        if ((refreeDoc.data() as User)?.accountType !== "refree") {
          return;
        }
        // check if is the match refree is the same as the invite refree
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) {
          return;
        }
        const matchData = matchDoc.data() as Match;
        if (matchData.refree.id !== refreeId) {
          return;
        }
        // match status should be refree waiting
        if (matchData.status !== "refree_waiting") {
          return;
        }
        // update match data
        if (afterData.action === "decline") {
          await db.collection("matches").doc(matchId).update({
            refree: {id: null, isAgreed: false},
            status: "coachs_edit",
          });
          // send notification to the coachs that the refree has declined the invite
          const notification1: NotificationFireStore = {
            from_id: matchId,
            to_id: matchData.team1.id,
            title: "Refree Invite Declined",
            message: "The refree has declined the invite.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification1);
          const notification2: NotificationFireStore = {
            from_id: matchId,
            to_id: matchData.team2.id,
            title: "Refree Invite Declined",
            message: "The refree has declined the invite.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
        } else if (afterData.action === "accept") {
          await db.collection("matches").doc(matchId).update({
            refree: {id: refreeId, isAgreed: true},
            status: "pending",
          });
          // send notification to the refree the match has added to his profile
          const notification: NotificationFireStore = {
            from_id: matchId,
            to_id: refreeId,
            title: "Match Added",
            message: "The match has been added to your profile.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          // send notification to coachs that the refree accept the Invite
          const notification2: NotificationFireStore = {
            from_id: matchId,
            to_id: matchData.team1.id,
            title: "Refree Invite Accepted",
            message: "The refree has accepted the invite.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          const notification3: NotificationFireStore = {
            from_id: matchId,
            to_id: matchData.team2.id,
            title: "Refree Invite Accepted",
            message: "The refree has accepted the invite.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification3);
        }
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
// get coach id from context auth user id
exports.changeCoach = functions.https.onCall(async (data: ChangeCoachData, context) => {
  const {memberid, teamid} = data;

  // require auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function require authentication."
    );
  }
  // get uid
  const coachid = context.auth.uid;

  if (!memberid || !teamid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require (memberid,teamid) parameters."
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


// Update match callable function Types
interface refreeEdit {
  type: "edit_result" | "cancel_match" | "end_match" | "set_in_progress";
  result?: {
    team1: number;
    team2: number;
  };
}
interface coachEdit {
  startIn: number | Timestamp;
  location: string;
  refreeid: string;
}
interface UpdateMatchData {
  matchid: string;
  requestUpdateInfo: refreeEdit | coachEdit;
}

// Update match callable function implementation
// it's for updating match details by one of coachs or refree
// this callable functin work just with classic_matchs
// possiblety edit for coaches is just in the "coachs_edit" status
// the function will update the match details and send notifications to the other coach
// possiblety edit for refree is just in the "in_progress" status
// send notification to the coachs when refree make (edit result, or cancel match, or end match actions)
// both accept is where the matchdata === udpateData and and other coach is aggredd
// make match in refree waiting status when both coachs agree on the match details
// and send invite request to selected refree
// the match edit_result or end can't be done if the match is not in progress
// refree can update status match to in progress after accept the invite


exports.updateMatch = functions.https.onCall(async (data: UpdateMatchData, context) => {
  // require auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function require authentication."
    );
  }
  // get uid
  const editorid = context.auth.uid;
  const {matchid, requestUpdateInfo} = data;

  if (!matchid || !requestUpdateInfo) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require (matchid,requestUpdateInfo) parameters."
    );
  }

  try {
    // Check if the match exists
    const matchDoc = await db.collection("matches").doc(matchid).get();
    if (!matchDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified match does not exist."
      );
    }
    const matchData = matchDoc.data() as Match;
    if (matchData.type !== "classic_match") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified match is not a classic match."
      );
    }
    // check if /teams/{team1.id}/members/{editorid} is exsit and role is coach if it set caoch1 = true
    const team1Doc = await db.collection("teams").doc(matchData.team1.id).get();
    const team2Doc = await db.collection("teams").doc(matchData.team2.id).get();
    if (!team1Doc.exists) {
      console.log("team1", team1Doc);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team1 does not exist."
      );
    }
    if (!team2Doc.exists) {
      console.log("team2", team2Doc);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team2 does not exist."
      );
    }
    const team1 = team1Doc.data() as Team;
    const team2 = team2Doc.data() as Team;
    const team1Name = team1?.teamName;
    const team2Name = team2?.teamName;
    let coach1 = false;
    let coach2 = false;
    const coach1doc = await db.collection("teams").doc(matchData.team1.id).collection("members").doc(editorid).get();
    if (coach1doc.exists && coach1doc.data()?.role === "coach") {
      coach1 = true;
    }
    // check if /teams/{team2.id}/members/{editorid} is exsit and role is coach if it set caoch2 = true
    const coach2doc = await db.collection("teams").doc(matchData.team2.id).collection("members").doc(editorid).get();
    if (coach2doc.exists && coach2doc.data()?.role === "coach") {
      coach2 = true;
    }
    if (matchData.status === "finish" || matchData.status === "cancled") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The match is already finished or canceled."
      );
    }
    if ((matchData.status === "in_progress" || matchData.status === "pending") && editorid !== matchData.refree.id && matchData.refree.isAgreed) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The match is in progress and only the refree can edit the match."
      );
    }
    if (matchData.status === "refree_waiting") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The match is waiting for the refree you can't edit on it until the refree accept the invite."
      );
    }
    if (matchData.status === "coachs_edit" && !coach1 && !coach2) {
      console.log("it s here some how");
      console.log("editorid", editorid);
      console.log("team1", matchData.team1.id);
      console.log("team2", matchData.team2.id);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The match is in 'coachs_edit' status and only the coachs can edit the match."
      );
    }

    if (matchData.status === "coachs_edit") {
      const updateData = requestUpdateInfo as coachEdit;
      if (!updateData.startIn || !updateData.location || !updateData.refreeid) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "The function require (startIn,location,refreeid) parameters."
        );
      }
      // validate refreeid should be refree
      const refreeDoc = await db.collection("users").doc(updateData.refreeid).get();
      if (!refreeDoc.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The specified refree does not exist."
        );
      }
      if ((refreeDoc.data() as User)?.accountType !== "refree") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The specified user is not a refree."
        );
      }
      // convert start in from mills to timestamp
      if (typeof updateData.startIn !== "object") {
        updateData.startIn = admin.firestore.Timestamp.fromMillis(updateData.startIn);
      }
      // validate startIn date should be in future
      if (updateData.startIn.toMillis() < Date.now()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The match start date should be in future."
        );
      }
      // validate location should be google map locaiton
      const googleMapsLinkRegex = /^https:\/\/(www\.)?google\.com\/maps\/place\/[^/]+\/@[0-9.-]+,[0-9.-]+,?[0-9]*z\/data=.*$/;
      if (!googleMapsLinkRegex.test(updateData.location)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The location should be a google maps link."
        );
      }
      // check if data is same and the other coach is agree if true send refree invite notification
      // if the new data from editor === old data && the other coach is agreed => send refree invite notification
      if (coach1) {
        if (
          matchData.refree.id === updateData.refreeid &&
          matchData.startIn?.toMillis() === updateData.startIn.toMillis() &&
          matchData.location === updateData.location && matchData.team2.isAgreed
        ) {
          // send notification to the refree
          const notification: NotificationFireStore = {
            from_id: matchid,
            to_id: updateData.refreeid,
            title: "Refree Invite",
            message: `You have invited to a Match as Refree, Between '${team1Name}' And '${team2Name}' at ${updateData.startIn.toDate().toLocaleString()}.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "refree_invite",
          };
          await db.collection("notifications").add(notification);
          // update match data
          await db.collection("matches").doc(matchid).update({
            team1: {id: matchData.team1.id, score: null, isAgreed: true},
            status: "refree_waiting",
          });
          // send notification to other caoch that the coach has accept the match details
          const notification2: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team2.id,
            title: "Match Details Updated",
            message: `The match details have been acceptd by the Team ${team1Name} Coach.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          return;
        } else {
          await db.collection("matches").doc(matchid).update({
            team1: {id: matchData.team1.id, score: null, isAgreed: true},
            team2: {id: matchData.team2.id, score: null, isAgreed: false},
            refree: {id: updateData.refreeid, isAgreed: false},
            startIn: updateData.startIn,
            location: updateData.location,
            status: "coachs_edit",
          });
        }
      } else {
        if (
          matchData.refree.id === updateData.refreeid &&
          matchData.startIn === updateData.startIn &&
          matchData.location === updateData.location && matchData.team1.isAgreed
        ) {
          // send notification to the refree
          const notification: NotificationFireStore = {
            from_id: matchid,
            to_id: updateData.refreeid,
            title: "Refree Invite",
            message: `You have invited to a Match as Refree, Between '${team1Name}' And '${team2Name}' at ${updateData.startIn.toDate().toLocaleString()}.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "refree_invite",
          };
          await db.collection("notifications").add(notification);
          // update match data
          await db.collection("matches").doc(matchid).update({
            team2: {id: matchData.team1.id, score: null, isAgreed: true},
            status: "refree_waiting",
          });
          // send notification to other caoch that the coach has accept the match details
          const notification2: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team1.id,
            title: "Match Details Updated",
            message: `The match details have been acceptd by the Team ${team2Name} Coach.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          return;
        } else {
          await db.collection("matches").doc(matchid).update({
            team1: {id: matchData.team1.id, score: null, isAgreed: false},
            team2: {id: matchData.team2.id, score: null, isAgreed: true},
            refree: {id: updateData.refreeid, isAgreed: false},
            startIn: updateData.startIn,
            location: updateData.location,
            status: "coachs_edit",
          });
        }
      }

      // send notification to the other coach
      const notification: NotificationFireStore = {
        from_id: matchid,
        to_id: coach1 ? matchData.team2.id : matchData.team1.id,
        title: "Match Details Updated",
        message: `The match details have been updated by the ${coach1 ? team1Name : team2Name} Coach.`,
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification);
    }

    if (matchData.status === "in_progress" || matchData.status === "pending") {
      const updateData = requestUpdateInfo as refreeEdit;
      if ((matchData.status === "pending") && !(updateData.type === "set_in_progress" || updateData.type === "cancel_match")) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The match is pending and only the refree can set it in progress or cancel it."
        );
      }
      if (updateData.type === "set_in_progress") {
        // update match data
        await db.collection("matches").doc(matchid).update({
          status: "in_progress",
        });
      } else if (updateData.type === "edit_result") {
        if (!updateData.result) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "The function require result parameter."
          );
        }
        // update match data
        await db.collection("matches").doc(matchid).update({
          team1: {id: matchData.team1.id, score: updateData.result.team1, isAgreed: true},
          team2: {id: matchData.team2.id, score: updateData.result.team2, isAgreed: true},
          refree: {id: matchData.refree.id, isAgreed: true},
          status: "in_progress",
        });
      } else if (updateData.type === "cancel_match") {
        // update match data
        await db.collection("matches").doc(matchid).update({
          status: "cancled",
        });
      } else if (updateData.type === "end_match") {
        // update match data
        // not possible to end match if result null for team1 or team2
        if (!matchData.team1.score || !matchData.team2.score) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "The match result should be not be for both teams."
          );
        }
        await db.collection("matches").doc(matchid).update({
          status: "finish",
          endedAt: admin.firestore.Timestamp.now(),
        });
      }

      // send notification to the coachs
      const notification1: NotificationFireStore = {
        from_id: matchid,
        to_id: matchData.team1.id,
        title: "Match Details Updated",
        message: "The match details have been updated by the refree.",
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification1);

      const notification2: NotificationFireStore = {
        from_id: matchid,
        to_id: matchData.team2.id,
        title: "Match Details Updated",
        message: "The match details have been updated by the refree.",
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification2);

      // send notification to winner
      if (updateData.type === "end_match" && matchData.team1.score && matchData.team2.score && matchData.team1.score !== matchData.team2.score) {
        // send notification for only winner not in draw or lose
        if (matchData.team1.score > matchData.team2.score) {
          const notification3: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team1.id,
            title: "Yeaaaah",
            message: "Congratulations! You have won the match.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification3);
        } else if (matchData.team1.score < matchData.team2.score) {
          const notification3: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team2.id,
            title: "Yeaaaah",
            message: "Congratulations! You have won the match.",
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification3);
        }
      }
    }
  } catch (error) {
    console.error("Error updating match: ", error);
    throw new functions.https.HttpsError(
      "unknown",
      "An error occurred while updating match."
    );
  }
});


// leave team for coach
//  the auth user context id should be the user who call the function
// should be a coach and have ateam
// the team should be empty that's mean there's no members expet the coach
// the team should not have any matchs in not finsish or cancled status
// after leave team the team name should be update to "_"
// send notification to coach that the team has been deleted

exports.leaveTeamForCoach = functions.https.onCall(async (data, context) => {
  const {teamId} = data;

  if (!teamId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require teamId parameter."
    );
  }
  // require auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function require authentication."
    );
  }
  // get uid
  const coachid = context.auth.uid;

  try {
    // Check if the coach exists in memebers subcollection and has the role of "coach"
    const coachDoc = await db.collection("teams").doc(teamId).collection("members").doc(coachid).get();

    if (!coachDoc.exists || coachDoc.data()?.role !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified coach does not exist or is not a coach."
      );
    }

    // Check if the team exists
    const teamDoc = await db.collection("teams").doc(teamId).get();
    const teamData = teamDoc.data() as Team;
    if (teamData.teamName === "_") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team is already deleted."
      );
    }
    // check if the team is empty
    const membersSnapshot = await db.collection(`/teams/${teamId}/members`).get();
    if (membersSnapshot.size > 1) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team is not empty."
      );
    }
    // check if the team has any matchs in not finsish or cancled status team1.id and team2.id
    const matchsSnapshot = await db.collection("matches").where("team1.id", "==", teamId).where("status", "not-in", ["finish", "cancled"]).get();
    if (!matchsSnapshot.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team has matchs in not finsish or cancled status."
      );
    }

    // check for team2.id
    const matchsSnapshot2 = await db.collection("matches").where("team2.id", "==", teamId).where("status", "not-in", ["finish", "cancled"]).get();
    if (!matchsSnapshot2.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team has matchs in not finsish or cancled status."
      );
    }


    // update team name to "_"
    await db.collection("teams").doc(teamId).update({teamName: "_"});

    // remove coach from team members
    await db.collection("teams").doc(teamId).collection("members").doc(coachid).delete();


    // send notification to coach that the team has been deleted
    const notification: NotificationFireStore = {
      from_id: teamId,
      to_id: coachid,
      title: "Team Deleted",
      message: "The team has been deleted.",
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification);

    return {success: true};
  } catch (error) {
    console.error("Error Leave Team For coach: ", error);
    throw new functions.https.HttpsError(
      "unknown",
      "An error occurred while Leave Team For coach."
    );
  }
}
);

