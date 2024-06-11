/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
admin.initializeApp();

const db = admin.firestore();
export type Action = "accept" | "decline" | "view";
type NotificationType = "info"
| "request_to_join_team"
| "request_to_join_tournament"
| "match_chalenge"
| "refree_invite"
| "invite_to_team"
| "invite_to_tournament"
| "invite_referee_to_tournament";

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
  type: "tournament" | "classic_match";
}

type accountT = "user" | "coach" | "refree" | "tournament_manager" | "player";

export interface User {
  username: string;
  accountType: accountT;
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

export interface Tournament {
  id: string;
  name: string;
  logo: string;
  description: string;
  start_date: Timestamp;
  end_date: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string;
  manager_id:string;
  refree_ids: string[];
  location: string;
  participants: string[];
  status: "pending" | "in-progress" | "finish" | "cancled";
  min_members_in_team: number;
  max_participants: number;
}

// Trigger for updates on notifications
export const onNotificationUpdate = functions.firestore
  .document("/notifications/{notificationId}")
  .onUpdate(async (change) => {
    // get uid
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
        // // check if editor is team coach
        // const editorDoc = await db.collection("teams").doc(teamId).collection("members").doc(editorid).get();
        // if (!editorDoc.exists) {
        //   return;
        // }
        // if ((editorDoc.data() as Member)?.role !== "coach") {
        //   return;
        // }
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
        // check if editor is userId
        // if (editorid !== userId) {
        //   return;
        // }
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
        // check if editor is team coach of the team that the requested send to
        // const editorDoc = await db.collection("teams").doc(toId).collection("members").doc(editorid).get();
        // if (!editorDoc.exists) {
        //   return;
        // }
        // if ((editorDoc.data() as Member)?.role !== "coach") {
        //   return;
        // }
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
        // check if editor is  refreeId
        // if (editorid !== refreeId) {
        //   return;
        // }
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
      } else if (type === "request_to_join_tournament" && afterData.action === "accept") {
        const teamId = afterData.from_id;
        const tournamentId = afterData.to_id;
        // check if editor is tournament manager
        // const editorDoc = await db.collection("users").doc(editorid).get();
        // if (!editorDoc.exists) {
        //   return;
        // }
        // if ((editorDoc.data() as User)?.accountType !== "tournament_manager") {
        //   return;
        // }

        // get tournament data

        const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
        if (!tournamentDoc.exists) {
          return;
        }
        const tournamentData = tournamentDoc.data() as Tournament;
        // chekc if tourman manager id == editor id
        // if (tournamentData.manager_id !== editorid) {
        //   return;
        // }

        // check if team is already in a tournament (by checking participants) in tournament
        if (tournamentData.participants.includes(teamId)) {
          return;
        }

        // get team data
        const teamDoc = await db.collection("teams").doc(teamId).get();
        if (!teamDoc.exists) {
          return;
        }
        const teamData = teamDoc.data() as Team;

        // check if team members is more then min_members that tournament requested

        const teamMembers = await db.collection(`/teams/${teamId}/members`).get();
        if (teamMembers.size < tournamentData.min_members_in_team) {
          // send notification to the team that the request has been declined
          const notification: NotificationFireStore = {
            from_id: tournamentId,
            to_id: teamId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `You can't join the tournament ${tournamentData.name} because your team members are less than the required number.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          // send notification to the tournament manager that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: teamId,
            to_id: tournamentId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `The team ${teamData.teamName} can't join the tournament ${tournamentData.name} because the team members are less than the required number.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          return;
        }
        //  check if participants lenght === max_participants or more
        if (tournamentData.participants.length >= tournamentData.max_participants) {
          // send notification to the team that the request has been declined
          const notification: NotificationFireStore = {
            from_id: tournamentId,
            to_id: teamId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `Your Team can't join the tournament ${tournamentData.name} because the tournament is full.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          // send notification to the tournament manager that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: teamId,
            to_id: tournamentId,
            title: "Request Declined",
            // eslint-disable-next-line max-len
            message: `The team ${teamData.teamName} can't join the tournament ${tournamentData.name} because the tournament is full`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          return;
        }
        // add the team to the tournament
        await db.collection("tournaments").doc(tournamentId).update({
          participants: admin.firestore.FieldValue.arrayUnion(teamId),
        });

        // send notification to the team that the request has been accepted
        const notification: NotificationFireStore = {
          from_id: tournamentId,
          to_id: teamId,
          title: "Request Accepted",
          message: `Your team has been added to the tournament ${tournamentData.name}.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification);
        // send notification to the tournament manager that the team has been added
        const notification2: NotificationFireStore = {
          from_id: teamId,
          to_id: tournamentId,
          title: "Team Added",
          message: `Your team has been added to the tournament ${tournamentData.name}.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification2);
      } else if (type === "invite_to_tournament" && afterData.action === "accept") {
        const teamId = afterData.to_id;
        const tournamentId = afterData.from_id;
        // check if editor is teamId coach
        // const editorDoc = await db.collection("users").doc(editorid).get();
        // if (!editorDoc.exists) {
        //   return;
        // }
        // if ((editorDoc.data() as User)?.accountType !== "coach") {
        //   return;
        // }
        // get team data
        const teamDoc = await db.collection("teams").doc(teamId).get();
        if (!teamDoc.exists) {
          return;
        }
        const teamData = teamDoc.data() as Team;
        // check if editor is the team coach in subcollection members inside team
        // const teamMemberDoc = await db.collection(`/teams/${teamId}/members`).doc(editorid).get();
        // if (!teamMemberDoc.exists) {
        //   return;
        // }
        // if ((teamMemberDoc.data() as Member)?.role !== "coach") {
        //   return;
        // }
        // get tournament data
        const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
        if (!tournamentDoc.exists) {
          return;
        }
        const tournamentData = tournamentDoc.data() as Tournament;
        // check if team is already in a tournament (by checking participants) in tournament
        if (tournamentData.participants.includes(teamId)) {
          return;
        }
        // check if team members is more then min_members that tournament requested
        const teamMembers = await db.collection(`/teams/${teamId}/members`).get();
        if (teamMembers.size < tournamentData.min_members_in_team) {
          // send notification to the team that the request has been declined
          const notification: NotificationFireStore = {
            from_id: tournamentId,
            to_id: teamId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `You can't join the tournament ${tournamentData.name} because your team members are less than the required number.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          // send notification to the tournament manager that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: teamId,
            to_id: tournamentId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `The team ${teamData.teamName} can't join the tournament ${tournamentData.name} because the team members are less than the required number.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          return;
        }
        //  check if participants lenght === max_participants or more
        if (tournamentData.participants.length >= tournamentData.max_participants) {
          // send notification to the team that the request has been declined
          const notification: NotificationFireStore = {
            from_id: tournamentId,
            to_id: teamId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `Your Team can't join the tournament ${tournamentData.name} because the tournament is full.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification);
          // send notification to the tournament manager that the request has been declined
          const notification2: NotificationFireStore = {
            from_id: teamId,
            to_id: tournamentId,
            title: "Invite Declined",
            // eslint-disable-next-line max-len
            message: `The team ${teamData.teamName} can't join the tournament ${tournamentData.name} because the tournament is full`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification2);
          return;
        }
        // add the team to the tournament
        await db.collection("tournaments").doc(tournamentId).update({
          participants: admin.firestore.FieldValue.arrayUnion(teamId),
        });

        // send notification to the team that the request has been accepted
        const notification: NotificationFireStore = {
          from_id: tournamentId,
          to_id: teamId,
          title: "Invite Accepted",
          message: `Your team has been added to the tournament ${tournamentData.name}.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification);
        // send notification to the tournament manager that the team has been added
        const notification2: NotificationFireStore = {
          from_id: teamId,
          to_id: tournamentId,
          title: "Team Added",
          message: `Your team has been added to the tournament ${tournamentData.name}.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification2);
      } else if (type === "invite_referee_to_tournament" && afterData.action === "accept") {
        const tournamentId = afterData.from_id;
        const refreeId = afterData.to_id;
        // check if referreid is editor
        // if (editorid !== refreeId) {
        //   return;
        // }
        // check if refreeId is refree
        const refreeDoc = await db.collection("users").doc(refreeId).get();
        if (!refreeDoc.exists) {
          return;
        }
        if ((refreeDoc.data() as User)?.accountType !== "refree") {
          return;
        }
        // get tournament data
        const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
        if (!tournamentDoc.exists) {
          console.log("tournament not found");
          return;
        }
        const tournamentData = tournamentDoc.data() as Tournament;
        // check if refreeId is in the tournament refree_ids
        if (tournamentData.refree_ids.includes(refreeId)) {
          console.log("refree is already in the tournament refree_ids");
          return;
        }
        // update tournament data
        await db.collection("tournaments").doc(tournamentId).update({
          refree_ids: admin.firestore.FieldValue.arrayUnion(refreeId),
        });
        // send notification to the refree the tournament has added to his profile
        const notification: NotificationFireStore = {
          from_id: tournamentId,
          to_id: refreeId,
          title: "Tournament Added",
          message: `The tournament ${tournamentData.name} has been added to your profile.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };

        await db.collection("notifications").add(notification);

        // send notification to the tournament manager that the refree accept the Invite
        const notification2: NotificationFireStore = {
          from_id: refreeId,
          to_id: tournamentId,
          title: "Refree Invite Accepted",
          message: "The refree has accepted the invite.",
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
        "The match is pending or in progress and only the refree can edit the match."
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
      // console.log("matchData", matchData);
      // console.log("updateData", updateData);
      // console.log("coach1 is the editor:", coach1);
      // console.log("coach2 is the editor:", coach2);
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
          matchData.startIn?.toMillis() === updateData.startIn.toMillis() &&
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
            team2: {id: matchData.team2.id, score: null, isAgreed: true},
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
        // update match data set score 0 - 0
        await db.collection("matches").doc(matchid).update({
          status: "in_progress",
          startIn: admin.firestore.Timestamp.now(),
          team1: {id: matchData.team1.id, score: 0, isAgreed: true},
          team2: {id: matchData.team2.id, score: 0, isAgreed: true},
        });
      } else if (updateData.type === "edit_result") {
        if (!updateData.result) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "The function require result parameter."
          );
        }
        // update match data on update the status to in progress update the date start in to timestamp now
        await db.collection("matches").doc(matchid).update({
          team1: {id: matchData.team1.id, score: updateData.result.team1, isAgreed: true},
          team2: {id: matchData.team2.id, score: updateData.result.team2, isAgreed: true},
          refree: {id: matchData.refree.id, isAgreed: true},
        });
      } else if (updateData.type === "cancel_match") {
        // update match data
        await db.collection("matches").doc(matchid).update({
          status: "cancled",
        });
      } else if (updateData.type === "end_match") {
        // update match data
        // not possible to end match if result null for team1 or team2 so it's should be 0 or more
        if ( matchData.team1.score === null || matchData.team2.score === null) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "The match result should be not null for both teams."
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
      if (updateData.type === "end_match" && matchData.team1.score && matchData.team2.score ) {
        // send notification to teams and congrate the winner
        if (matchData.team1.score > matchData.team2.score) {
          const notification3: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team1.id,
            title: "Match Finished",
            message: `Congratulation! Your team ${team1Name} has won the match.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification3);
          const notification4: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team2.id,
            title: "Match Finished",
            message: `Your team ${team2Name} has lost the match.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification4);
        } else if (matchData.team1.score < matchData.team2.score) {
          const notification3: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team2.id,
            title: "Match Finished",
            message: `Congratulation! Your team ${team2Name} has won the match.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification3);
          const notification4: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team1.id,
            title: "Match Finished",
            message: `Your team ${team1Name} has lost the match.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification4);
        } else {
          const notification3: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team1.id,
            title: "Match Finished",
            message: `The match between ${team1Name} and ${team2Name} has ended in a draw.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification3);
          const notification4: NotificationFireStore = {
            from_id: matchid,
            to_id: matchData.team2.id,
            title: "Match Finished",
            message: `The match between ${team1Name} and ${team2Name} has ended in a draw.`,
            createdAt: admin.firestore.Timestamp.now(),
            action: null,
            type: "info",
          };
          await db.collection("notifications").add(notification4);
        }
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error updating match: ", error);
    throw new functions.https.HttpsError(
      error.code || "unknown",
      error.message || "An error occurred while updating match."
    );
  }
});

// [x] : the coach can cancel match that is in coachs_edit or refree_waiting or pending status
// [x] : test if the editor is one of coach of team1 or team2
// [x] : send notification to the other coach that the match has been canceled by other team {teanName}
// [x] : send notification to refree in pending status that the match has canceld by team {teanName}
// [x] : this callable functin work just with classic_matchs
// [x] : the function will update the match status to "cancled" and send notifications to the other coach
// and refree if the match status is "pending"

// cancel match callable function Types
interface CancelMatchData {
  matchid: string;
}
// cancel match callable function implementation
exports.cancelMatch = functions.https.onCall(async (data: CancelMatchData, context) => {
  // require auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function require authentication."
    );
  }
  // get uid
  const editorid = context.auth.uid;
  const {matchid} = data;

  if (!matchid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require matchid parameter."
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
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team1 does not exist."
      );
    }
    if (!team2Doc.exists) {
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

    // test if the editor is the one of coachs if not throw error
    if (!coach1 && !coach2) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The editor is not a coach of any team."
      );
    }
    if (matchData.status === "finish" || matchData.status === "cancled") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The match is already finished or canceled."
      );
    }
    if (matchData.status === "in_progress") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The match is in progress and can't be canceled."
      );
    }
    // cancel match
    if (matchData.status === "coachs_edit" || matchData.status === "refree_waiting" || matchData.status === "pending") {
      // update match data
      await db.collection("matches").doc(matchid).update({
        status: "cancled",
      });

      // send notification to the other coach
      const notification1: NotificationFireStore = {
        from_id: matchid,
        to_id: coach1 ? matchData.team2.id : matchData.team1.id,
        title: "Match Canceled",
        message: `The match has been canceled by the ${coach1 ? team1Name : team2Name} Coach.`,
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification1);

      // send notification to refree in pending status
      if (matchData.status === "pending") {
        const notification2: NotificationFireStore = {
          from_id: matchid,
          to_id: matchData.refree.id as string,
          title: "Match Canceled",
          message: `The match has been canceled by the ${coach1 ? team1Name : team2Name} Coach.`,
          createdAt: admin.firestore.Timestamp.now(),
          action: null,
          type: "info",
        };
        await db.collection("notifications").add(notification2);
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error canceling match: ", error);
    throw new functions.https.HttpsError(
      error.code || "unknown",
      error.message || "An error occurred while canceling match."
    );
  }
}
);

// leave team for coach
//  the auth user context id should be the user who call the function
// should be a coach and have ateam
// the team should be empty that's mean there's no members expet the coach
// the team should not have any matchs in not finsish or cancled status
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
    // const teamDoc = await db.collection("teams").doc(teamId).get();
    // const teamData = teamDoc.data() as Team;
    // if (teamData.teamName === "_") {
    //   throw new functions.https.HttpsError(
    //     "failed-precondition",
    //     "The team is already deleted."
    //   );
    // }
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
    // await db.collection("teams").doc(teamId).update({teamName: "_"});

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

// // Ensure unique username on create/update
// exports.ensureUniqueUsername = functions.firestore
//   .document("users/{userId}")
//   .onWrite(async (change, context) => {
//     const newValue = change.after.exists ? change.after.data() : null;
//     const oldValue = change.before.exists ? change.before.data() : null;

//     // Check if username field exists and meets length requirements
//     if (newValue && newValue.username) {
//       const username = newValue.username;
//       if (username.length < 4 || username.length > 30) {
//         throw new functions.https.HttpsError("invalid-argument", "Username must be between 4 and 30 characters.");
//       }

//       // Check if username is unique
//       const usersRef = admin.firestore().collection("users");
//       const querySnapshot = await usersRef.where("username", "==", username).get();
//       if (!querySnapshot.empty) {
//         // If there are any documents with the same username, check if it's not the same document being updated
//         const isUnique = querySnapshot.docs.every((doc) => doc.id === context.params.userId);
//         if (!isUnique) {
//           throw new functions.https.HttpsError("already-exists", "Username is already taken.");
//         }
//       }
//     }

//     // If deleting a user or if username was not changed, no need to check
//     if (!newValue || (oldValue && oldValue.username === newValue.username)) {
//       return null;
//     }

//     return null;
//   });


// // Ensure unique team name on create/update
// exports.ensureUniqueTeamName = functions.firestore
//   .document("teams/{teamId}")
//   .onWrite(async (change, context) => {
//     const newValue = change.after.exists ? change.after.data() : null;
//     const oldValue = change.before.exists ? change.before.data() : null;
//     // Check if team name field exists and meets length requirements
//     if (newValue && newValue.teamName) {
//       const teamName = newValue.teamName;
//       if (teamName.length < 4 || teamName.length > 30) {
//         throw new functions.https.HttpsError("invalid-argument", "Team name must be between 4 and 30 characters.");
//       }
//       // Check if team name is unique
//       const teamsRef = admin.firestore().collection("teams");
//       const querySnapshot = await teamsRef.where("teamName", "==", teamName).get();
//       if (!querySnapshot.empty) {
//         // If there are any documents with the same team name, check if it's not the same document being updated
//         const isUnique = querySnapshot.docs.every((doc) => doc.id === context.params.teamId);
//         if (!isUnique) {
//           throw new functions.https.HttpsError("already-exists", "Team name is already taken.");
//         }
//       }
//     }
//     // If deleting a team or if team name was not changed, no need to check
//     if (!newValue || (oldValue && oldValue.teamName === newValue.teamName)) {
//       return null;
//     }
//     return null;
//   });

// create team callback function

interface TeamData {
  teamName: string;
  teamLogo: string;
  teamDescription: string;
}

exports.createTeam = functions.https.onCall(async (data: TeamData, context) => {
  const {teamName, teamLogo, teamDescription} = data;

  if (!teamName || !teamLogo || !teamDescription) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require (teamName,teamLogo,teamDescription) parameters."
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
    // check team name should be between 4 and 30 caracters and lower case and containe only letters and numbers and _ and no spaces
    const teamNameRegex = /^[a-z0-9_]{4,30}$/;
    if (!teamNameRegex.test(teamName)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Team name must be between 4 and 30 characters and contain only letters, numbers, and _."
      );
    }
    if (teamName !== teamName.toLowerCase()) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Team name must be in lower case."
      );
    }
    // check if user account is coach
    const userDoc = await db.collection("users").doc(coachid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user does not exist."
      );
    }
    const userData = userDoc.data() as User;
    if (userData.accountType !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user is not a coach."
      );
    }
    // checking if the user is in the members subcollections using collection Group
    const membersSnapshot = await db.collectionGroup("members").where("uid", "==", coachid).get();
    if (!membersSnapshot.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The coach is already a member of a team."
      );
    }

    // Check if the team name is unique
    const teamsRef = db.collection("teams");
    const querySnapshot = await teamsRef.where("teamName", "==", teamName).get();
    if (!querySnapshot.empty) {
      throw new functions.https.HttpsError("already-exists", "Team name is already taken.");
    }
    // Create a new team document
    const newTeam = {
      teamName: teamName,
      teamLogo: teamLogo,
      description: teamDescription,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: coachid,
      updatedAt: admin.firestore.Timestamp.now(),
      blackList: [],
    };
    const teamRef = await db.collection("teams").add(newTeam);

    // Add the coach as the first member of the team
    await db.collection("teams").doc(teamRef.id).collection("members").doc(coachid).set({
      team_id: teamRef.id,
      uid: coachid,
      joinedAt: admin.firestore.Timestamp.now(),
      role: "coach",
    });

    return {success: true, teamId: teamRef.id};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error creating team: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while creating team."
    );
  }
});

// update team callable function

interface UpdateTeamData {
  teamId: string;
  teamName?: string;
  teamLogo?: string;
  teamDescription?: string;
}

exports.updateTeam = functions.https.onCall(async (data: UpdateTeamData, context) => {
  const {teamId, teamName, teamLogo, teamDescription} = data;

  if (!teamId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require teamId parameter."
    );
  }
  if (!teamName && !teamLogo && !teamDescription) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require at least one parameter to update."
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
    // check team name
    if (teamName) {
      // check team name should be between 4 and 30 caracters and lower case and containe only letters and numbers and _ and no spaces
      const teamNameRegex = /^[a-z0-9_]{4,30}$/;
      if (!teamNameRegex.test(teamName)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Team name must be between 4 and 30 characters and contain only letters, numbers, and _."
        );
      }
    }
    if (teamName && teamName !== teamName.toLowerCase()) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Team name must be in lower case."
      );
    }
    // check if user account is coach
    const userDoc = await db.collection("users").doc(coachid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user does not exist."
      );
    }
    const userData = userDoc.data() as User;
    if (userData.accountType !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user is not a coach."
      );
    }
    // check if the team exists
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified team does not exist."
      );
    }
    // const teamData = teamDoc.data() as Team;
    // ceck if the coach is member of team and have coach role
    const coachDoc = await db.collection("teams").doc(teamId).collection("members").doc(coachid).get();
    if (!coachDoc.exists || coachDoc.data()?.role !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified coach is not a coach in the team."
      );
    }


    // Check if the team name is unique
    if (teamName) {
      const teamsRef = db.collection("teams");
      const querySnapshot = await teamsRef.where("teamName", "==", teamName).get();
      if (!querySnapshot.empty) {
        throw new functions.https.HttpsError("already-exists", "Team name is already taken.");
      }
    }

    // Update the team document with the new data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {updatedAt: admin.firestore.Timestamp.now()};
    if (teamName) {
      updateData.teamName = teamName;
    }
    if (teamLogo) {
      updateData.teamLogo = teamLogo;
    }
    if (teamDescription) {
      updateData.description = teamDescription;
    }
    await db.collection("teams").doc(teamId).update(updateData);

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error updating team: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while updating team."
    );
  }
}
);

// create user callback function
interface UserData {
  username: string;
  firstName?:string;
  lastName?:string;
  avatar?:string;
}

exports.createUser = functions.https.onCall(async (data: UserData, context) => {
  const {username, firstName, lastName, avatar} = data;

  if (!username) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require username parameter."
    );
  }
  // check if username is lowercase and between 4 to 30 caracters and container no spaces juset caracters and numbers and underscores using regix and change it if was
  if (!/^[a-z0-9_]{4,30}$/.test(username)) {
    // change username and make it valid
    // make username lowercase
    let eusername = username.toLowerCase();
    // remove all spaces and non (a-z0-9_) caracters
    eusername = eusername.replace(/[^a-z0-9_]/g, "");
    // username should be between 4 and 30 characters
    if (eusername.length < 4 ) {
      eusername += Math.random().toString(36).substring(7).toLowerCase();
    }
    if (eusername.length > 30) {
      eusername = eusername.substring(0, 30);
    }
  }

  // require auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function require authentication."
    );
  }
  // get uid
  const uid = context.auth.uid;

  try {
    // check if user already doc already exists
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The user already exists."
      );
    }
    let eusername = username.toLowerCase();
    // username should be between 4 and 30 characters
    if (eusername.length < 4 ) {
      eusername += Math.random().toString(36).substring(7).toLowerCase();
    }
    if (eusername.length > 30) {
      eusername = eusername.substring(0, 30);
    }
    // Check if the username is unique if not add to it rand string and check again
    const usersRef = db.collection("users");
    let querySnapshot = await usersRef.where("username", "==", eusername).get();
    while (!querySnapshot.empty) {
      querySnapshot = await usersRef.where("username", "==", eusername).get();
      if (querySnapshot.empty) {
        break;
      }
      eusername += Math.random().toString(36).substring(7).toLowerCase();
    }

    const newUser = {
      username: eusername,
      firstName: firstName || null,
      lastName: lastName || null,
      avatar: avatar || null,
      accountType: "user",
      joinDate: admin.firestore.Timestamp.now(),
      gender: "male",
    };
    await db.collection("users").doc(uid).set(newUser);

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error creating user: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while creating user."
    );
  }
});

// update user callable function
interface UpdateUserData {
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatar?: string;
  birthday?: admin.firestore.Timestamp;
  gender: "male"|"female";
  address?: string;
  phoneNumbers?: string[];
}

exports.updateUser = functions.https.onCall(async (data: UpdateUserData, context) => {
  const {username, firstName, lastName, bio, avatar, birthday, gender, address, phoneNumbers} = data;

  if (!username && !firstName && !lastName && !bio && !avatar && !gender && !address && !phoneNumbers) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require at least one parameter to update."
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
  const uid = context.auth.uid;

  try {
    // check if user doc exists
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The user does not exist."
      );
    }
    // Check if the username is unique
    if (username) {
      // check username
      const eusername = username;
      if (!/^[a-z0-9_]{4,30}$/.test(eusername)) {
        // throw error if username is not valid
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Username must contain only letters, numbers, and underscores."
        );
      }
      // username should be between 4 and 30 characters
      if (eusername.length < 4 || eusername.length > 30) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Username must be between 4 and 30 characters."
        );
      }

      const usersRef = db.collection("users");
      const querySnapshot = await usersRef.where("username", "==", eusername).get();
      if (!querySnapshot.empty) {
        throw new functions.https.HttpsError("already-exists", "Username is already taken.");
      }
    }

    // Update the user document with the new data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (username) {
      updateData.username = username.toLowerCase();
    }
    if (firstName) {
      updateData.firstName = firstName;
    }
    if (lastName) {
      updateData.lastName = lastName;
    }
    if (bio) {
      updateData.bio = bio;
    }
    if (avatar) {
      updateData.avatar = avatar;
    }
    if (birthday) {
      updateData.birthday = birthday;
    }
    if (gender) {
      updateData.gender = gender;
    }
    if (address) {
      updateData.address = address;
    }
    if (phoneNumbers) {
      updateData.phoneNumbers = phoneNumbers;
    }
    await db.collection("users").doc(uid).update(updateData);

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error updating user: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while updating user."
    );
  }
}
);


// change account type callable function get user from context auth and update user doc


exports.changeAccountType = functions.https.onCall(async (data: {accountType: accountT}, context) => {
  const {accountType} = data;

  if (!accountType) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require accountType parameter."
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
  const uid = context.auth.uid;
  try {
    // check if user doc exists
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The user does not exist."
      );
    }
    const userData = userDoc.data() as User;
    // check if account type of user is same to what the user want to change to
    if (userData.accountType === accountType) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The user account type is already the same."
      );
    }
    // if user account type was coach or player check if player is member of a team before change is to new account type
    if (userData.accountType === "coach" || userData.accountType === "player") {
      const membersSnapshot = await db.collectionGroup("members").where("uid", "==", uid).get();
      if (!membersSnapshot.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The user is already a member of a team."
        );
      }
    }
    // if account type is refree check if the user is refree in any match have status not finish or cancled or in coachs_edit status
    if (userData.accountType === "refree") {
      const matchsSnapshot = await db.collection("matches").where("refree.id", "==", uid).where("status", "not-in", ["finish", "cancled", "coachs_edit"]).get();
      if (!matchsSnapshot.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The user is refree in a match that is not finish or cancled."
        );
      }
      // check if referee already in a tournament referee_ids list
      const tournamentsSnapshot = await db.collection("tournaments").where("referee_ids", "array-contains", uid).get();
      if (!tournamentsSnapshot.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The user is referee in a tournament."
        );
      }
    }
    // if accountType was tournament_manager we need to check if the user is manager in any tournament that not canceld or finish
    if (userData.accountType === "tournament_manager") {
      const tournamentsSnapshot = await db.collection("tournaments").where("manager_id", "==", uid).where("status", "not-in", ["finish", "cancled"]).get();
      if (!tournamentsSnapshot.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The user is manager in a tournament that is not finish or cancled."
        );
      }
    }
    // Update the user document with the new data
    await db.collection("users").doc(uid).update({accountType: accountType});

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error changing account type: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while changing account type."
    );
  }
}
);

// leave tournament for team
// check auth user and get uid
// is uid the coach of teamid
// get tournament
// is team in the tournament
// is tournament in pending status
// leave tournament
// send notification to tournament and team

exports.leaveTournamentForTeam = functions.https.onCall(async (data: {tournamentId: string, teamid:string}, context) => {
  const {tournamentId, teamid} = data;
  if (!tournamentId || !teamid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require (tournamentId,teamid) parameters."
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
    // check if user account is coach
    const userDoc = await db.collection("users").doc(coachid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user does not exist."
      );
    }
    const userData = userDoc.data() as User;
    if (userData.accountType !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user is not a coach."
      );
    }
    // check if the team exists
    const teamDoc = await db.collection("teams").doc(teamid).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified team does not exist."
      );
    }
    // get teamInfo
    const teamData = teamDoc.data() as Team;
    // check if auth is the coach of team by checking his role in members subcollection of team
    const coachDoc = await db.collection("teams").doc(teamid).collection("members").doc(coachid).get();
    if (!coachDoc.exists || coachDoc.data()?.role !== "coach") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified coach is not a coach of the team."
      );
    }
    // check if the team is in the tournament
    const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified tournament does not exist."
      );
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    // check if the team is in the tournament participants array
    if (!tournamentData.participants.includes(teamid)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The team is not in the tournament."
      );
    }
    // check if the tournament is in pending status
    if (tournamentData.status !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The tournament is not in pending status, after tournament start you can't leave it."
      );
    }
    // leave tournament
    // remove team from tournament paticipants array
    const newTeams = tournamentData.participants.filter((team) => team !== teamid);
    await db.collection("tournaments").doc(tournamentId).update({participants: newTeams});
    // send notification to tournament
    const notification1: NotificationFireStore = {
      from_id: teamid,
      to_id: tournamentId,
      title: "Team Left",
      message: `The team ${teamData.teamName} has left the tournament ${tournamentData.name}.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification1);
    // send notification to team
    const notification2: NotificationFireStore = {
      from_id: tournamentId,
      to_id: teamid,
      title: "Tournament Left",
      message: `The team ${teamData.teamName} has left the tournament ${tournamentData.name}.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification2);

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error leaving tournament for team: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while leaving tournament for team."
    );
  }
}
);

// leave tournament for referee
// check auth user and get uid
// is uid the referee
// get tournament
// is referee in the tournament
// is tournament in pending status
// leave tournament
// send notification to tournament and referee

exports.leaveTournamentForReferee = functions.https.onCall(async (data: {tournamentId: string}, context) => {
  const {tournamentId} = data;
  if (!tournamentId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require tournamentId parameter."
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
  const refereeid = context.auth.uid;

  try {
    // check if user account is referee
    const userDoc = await db.collection("users").doc(refereeid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user does not exist."
      );
    }
    const userData = userDoc.data() as User;
    if (userData.accountType !== "refree") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user is not a referee."
      );
    }
    // check if the referee is in the tournament
    const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified tournament does not exist."
      );
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    // check if the referee is in the tournament referee_ids array
    if (!tournamentData.refree_ids.includes(refereeid)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The referee is not in the tournament."
      );
    }
    // check if the tournament is in pending status
    if (tournamentData.status !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The tournament is not in pending status, after tournament start you can't leave it."
      );
    }
    // leave tournament
    // remove referee from tournament referee_ids array
    const newReferees = tournamentData.refree_ids.filter((referee) => referee !== refereeid);
    await db.collection("tournaments").doc(tournamentId).update({refree_ids: newReferees});
    // send notification to tournament
    const notification1: NotificationFireStore = {
      from_id: refereeid,
      to_id: tournamentId,
      title: "Referee Left",
      message: `The referee ${userData.username} has left the tournament ${tournamentData.name}.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification1);
    // send notification to referee
    const notification2: NotificationFireStore = {
      from_id: tournamentId,
      to_id: refereeid,
      title: "Tournament Left",
      message: `The referee ${userData.username} has left the tournament ${tournamentData.name}.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification2);

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error leaving tournament for referee: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while leaving tournament for referee."
    );
  }
}
);

// remove tournament that in pending status
// check auth user and get uid
// is uid the manager of tournamentid
// get tournament
// is tournament in pending status
// remove tournament
// send notification to manager id and all referees and all teams that tournament has canceld

exports.removeTournament = functions.https.onCall(async (data: {tournamentId: string}, context) => {
  const {tournamentId} = data;
  if (!tournamentId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function require tournamentId parameter."
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
  const managerid = context.auth.uid;

  try {
    // check if user account is tournament_manager
    const userDoc = await db.collection("users").doc(managerid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user does not exist."
      );
    }
    const userData = userDoc.data() as User;
    if (userData.accountType !== "tournament_manager") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified user is not a tournament manager."
      );
    }
    // check if the tournament exists
    const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified tournament does not exist."
      );
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    // check if auth is the manager of tournament by checking his role in manager_id field of tournament
    if (tournamentData.manager_id !== managerid) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified manager is not a manager of the tournament."
      );
    }
    // check if the tournament is in pending status
    if (tournamentData.status !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The tournament is not in pending status."
      );
    }
    // remove tournament
    await db.collection("tournaments").doc(tournamentId).delete();
    // send notification to manager
    const notification1: NotificationFireStore = {
      from_id: tournamentId,
      to_id: managerid,
      title: "Tournament Removed",
      message: `The tournament ${tournamentData.name} has been removed.`,
      createdAt: admin.firestore.Timestamp.now(),
      action: null,
      type: "info",
    };
    await db.collection("notifications").add(notification1);
    // send notification to all referees
    for (const refereeid of tournamentData.refree_ids) {
      const notification2: NotificationFireStore = {
        from_id: tournamentId,
        to_id: refereeid,
        title: "Tournament Cancelled",
        message: `The tournament ${tournamentData.name} has been cancelled.`,
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification2);
    }
    // send notification to all teams
    for (const teamid of tournamentData.participants) {
      const notification3: NotificationFireStore = {
        from_id: tournamentId,
        to_id: teamid,
        title: "Tournament Cancelled",
        message: `The tournament ${tournamentData.name} has been cancelled.`,
        createdAt: admin.firestore.Timestamp.now(),
        action: null,
        type: "info",
      };
      await db.collection("notifications").add(notification3);
    }

    return {success: true};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    console.error("Error removing tournament: ", error);
    throw new functions.https.HttpsError(
      error?.code || "unknown",
      error?.message || "An error occurred while removing tournament."
    );
  }
}
);

