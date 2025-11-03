import React, { useState, useCallback } from "react";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";
import {
  createTeam,
  getAvailableTeams,
  joinTeam,
  getUserTeams,
  removeMember,
  deleteTeam,
  getTeamMemberProfile,
  updateTeamName,
  leaveTeam,
  getTeamByCode,
  updateTeamSize,
} from "@/services/teamService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FaCrown,
  FaUsers,
  FaChartLine,
  FaTrash,
  FaTimes,
  FaPlusCircle,
  FaUserTie,
  FaSearch,
  FaEdit,
  FaCopy,
  FaSignOutAlt,
} from "react-icons/fa";
import TeamMatchmaking from "@/components/TeamMatchmaking";
import MatchmakingPool from "@/components/MatchmakingPool";

interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  elo: number;
  joinedAt?: string;
}

interface Team {
  id: string;
  name: string;
  code: string;
  captainId: string;
  captainEmail: string;
  members: TeamMember[];
  maxSize: number;
  averageElo: number;
  createdAt: string;
  updatedAt: string;
}

interface MemberProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  rating: number;
  rd: number;
  bio?: string;
}

interface SelectedMember {
  teamId: string;
  memberUserId: string;
  teamCaptainId?: string;
  teamCaptainEmail?: string;
}

const TeamBuilder: React.FC = () => {
  const [user] = useAtom(userAtom);
  const [teamName, setTeamName] = useState("");
  const [maxSize, setMaxSize] = useState<number>(4);
  const [isCreating, setIsCreating] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(
    null
  );
  const [isMemberProfileOpen, setIsMemberProfileOpen] = useState(false);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(
    null
  );
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingSize, setEditingSize] = useState(false);
  const [editTeamName, setEditTeamName] = useState<string>("");
  const [searchCode, setSearchCode] = useState<string>("");
  const [joiningByCode, setJoiningByCode] = useState(false);

  // Fetch available teams
  const fetchAvailableTeams = useCallback(async () => {
    try {
      const teams = await getAvailableTeams();
      setAvailableTeams(teams || []);
    } catch (error) {
      console.error("Failed to fetch available teams:", error);
      setAvailableTeams([]);
    }
  }, []);

  // Fetch user's teams
  const fetchUserTeams = useCallback(async () => {
    try {
      const teams = await getUserTeams();
      setUserTeams(teams || []);
    } catch (error) {
      console.error("Failed to fetch user teams:", error);
      setUserTeams([]);
    }
  }, []);

  React.useEffect(() => {
    fetchAvailableTeams();
    fetchUserTeams();
  }, [fetchAvailableTeams, fetchUserTeams]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    // Check if user is already in a team
    if (userTeams && userTeams.length > 0) {
      setError(
        "You are already in a team. Leave your current team before creating a new one."
      );
      return;
    }

    setIsCreating(true);
    setError("");
    setSuccess("");
    try {
      await createTeam({ name: teamName, maxSize });
      setTeamName("");
      setMaxSize(4);
      setSuccess("Team created successfully!");
      fetchAvailableTeams();
      fetchUserTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to create team");
      console.error("Failed to create team:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      await joinTeam(teamId);
      setSuccess("Successfully joined team!");
      fetchAvailableTeams();
      fetchUserTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to join team");
      console.error("Failed to join team:", error);
      setTimeout(() => setError(""), 5000);
    }
  };

  const isUserInTeam = userTeams && userTeams.length > 0;

  const handleViewMemberProfile = async (memberId: string, team?: Team) => {
    try {
      const profile = await getTeamMemberProfile(memberId);
      setMemberProfile(profile);

      // Store team and member info for captain actions
      if (team) {
        setSelectedMember({
          memberUserId: memberId,
          teamId: team.id,
          teamCaptainId: team.captainId,
          teamCaptainEmail: team.captainEmail,
        });
      }

      setIsMemberProfileOpen(true);
    } catch (error) {
      console.error("Failed to load member profile:", error);
    }
  };

  const handleRemoveMember = async (
    teamId: string,
    memberId: string
  ): Promise<void> => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await removeMember(teamId, memberId);
      setSuccess("Member removed successfully");
      fetchUserTeams();
      fetchAvailableTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to remove member");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleDeleteTeam = async (teamId: string): Promise<void> => {
    if (
      !confirm(
        "Are you sure you want to delete this team? This action cannot be undone."
      )
    )
      return;

    try {
      await deleteTeam(teamId);
      setSuccess("Team deleted successfully");
      fetchUserTeams();
      fetchAvailableTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to delete team");
      setTimeout(() => setError(""), 5000);
    }
  };

  const isCaptain = (team: Team | null): boolean => {
    if (!team || !user) return false;
    
    // Convert captainId to string if it's an object (for backwards compatibility)
    const captainIdStr = typeof team.captainId === 'string' 
      ? team.captainId 
      : (team.captainId as any)?.$oid || String(team.captainId);
    
    // Convert user.id to string if needed
    const userIdStr = typeof user.id === 'string'
      ? user.id
      : (user.id as any)?.$oid || String(user.id);
    
    // Check both ID and email
    return captainIdStr === userIdStr || team.captainEmail === user?.email;
  };

  const handleEditTeamName = (team: Team) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
  };

  const handleSaveTeamName = async (teamId: string): Promise<void> => {
    if (!editTeamName.trim()) {
      setError("Team name cannot be empty");
      return;
    }

    try {
      await updateTeamName(teamId, editTeamName);
      setSuccess("Team name updated successfully!");
      setEditingTeamId(null);
      fetchUserTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to update team name");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleUpdateTeamSize = async (
    teamId: string,
    newSize: number
  ): Promise<void> => {
    try {
      await updateTeamSize(teamId, newSize);
      setSuccess("Team size updated successfully!");
      setEditingSize(false);
      fetchUserTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to update team size");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleCopyTeamCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setSuccess(`Team code ${code} copied to clipboard!`);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleLeaveTeam = async (teamId: string): Promise<void> => {
    if (!window.confirm("Are you sure you want to leave this team?")) {
      return;
    }

    try {
      await leaveTeam(teamId);
      setSuccess("You have left the team");
      fetchUserTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to leave team");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleJoinByCode = async (): Promise<void> => {
    if (!searchCode.trim()) {
      setError("Please enter a team code");
      return;
    }

    setJoiningByCode(true);
    try {
      const team = await getTeamByCode(searchCode.toUpperCase());
      await joinTeam(team.id);
      setSuccess(`Successfully joined ${team.name}!`);
      setSearchCode("");
      fetchUserTeams();
      fetchAvailableTeams();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      setError((error as Error).message || "Failed to join team");
      setTimeout(() => setError(""), 5000);
    } finally {
      setJoiningByCode(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Builder</h1>
        <p className="text-gray-600">
          Create or join a team to participate in team debates
        </p>
      </div>

      {/* User Status Banner */}
      <div
        className={`mb-6 p-4 rounded-lg border ${
          isUserInTeam ? "bg-card border-border" : "bg-muted border-border"
        }`}
      >
        <div className="flex items-center gap-2">
          <FaUsers
            className={isUserInTeam ? "text-primary" : "text-muted-foreground"}
          />
          <p className="text-sm font-medium">
            {isUserInTeam
              ? "You are currently in a team"
              : "You are not in any team yet"}
          </p>
        </div>
      </div>

      {/* Join by Code Section */}
      {!isUserInTeam && (
        <Card className="mb-6 border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FaSearch />
              Join by Team Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter 6-character team code..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1"
                onKeyPress={(e) => e.key === "Enter" && handleJoinByCode()}
              />
              <Button
                onClick={handleJoinByCode}
                disabled={joiningByCode || !searchCode.trim()}
              >
                {joiningByCode ? "Joining..." : "Join Team"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Team Section */}
      {!isUserInTeam && (
        <Card className="mb-6 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FaPlusCircle />
              Create New Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded text-primary text-sm">
                {success}
              </div>
            )}
            <div className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter a catchy team name..."
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="flex-1"
                  onKeyPress={(e) => e.key === "Enter" && handleCreateTeam()}
                />
                <Button
                  onClick={handleCreateTeam}
                  disabled={isCreating || !teamName.trim()}
                  className="px-8"
                >
                  {isCreating ? "Creating..." : "Create Team"}
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  <FaUsers className="inline mr-2" />
                  Team Size
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={maxSize === 2 ? "default" : "outline"}
                    onClick={() => setMaxSize(2)}
                    className="flex-1"
                  >
                    <FaUsers className="mr-1" /> 2 Members
                  </Button>
                  <Button
                    type="button"
                    variant={maxSize === 4 ? "default" : "outline"}
                    onClick={() => setMaxSize(4)}
                    className="flex-1"
                  >
                    <FaUsers className="mr-1" /> 4 Members
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                <FaSearch className="inline mr-1" />
                Teams match only with teams of the same size!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matchmaking Pool Debug */}
      <MatchmakingPool />

      {/* Your Teams */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaUserTie />
            Your Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!userTeams || userTeams.length === 0 ? (
            <div className="text-center py-12">
              <FaUsers className="text-6xl mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg mb-2">No team yet!</p>
              <p className="text-gray-400 text-sm">
                Create a team or join an existing one to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userTeams.map((team) => (
                <div
                  key={team.id}
                  className="relative overflow-hidden p-6 bg-card border rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        {editingTeamId === team.id && isCaptain(team) ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editTeamName}
                              onChange={(e) => setEditTeamName(e.target.value)}
                              className="flex-1"
                              onKeyPress={(e) =>
                                e.key === "Enter" && handleSaveTeamName(team.id)
                              }
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveTeamName(team.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingTeamId(null);
                                setEditTeamName("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-2xl text-foreground">
                              {team.name}
                            </h3>
                            {isCaptain(team) && (
                              <button
                                onClick={() => handleEditTeamName(team)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                title="Edit team name"
                              >
                                <FaEdit className="text-gray-400" />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <div className="flex items-center gap-1 text-gray-600">
                            <span className="font-medium">
                              <FaCrown className="inline text-yellow-500" />{" "}
                              Captain:
                            </span>
                            <span>{team.captainEmail}</span>
                          </div>
                          {team.code && (
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary">
                                Code: {team.code}
                              </Badge>
                              <button
                                onClick={() => handleCopyTeamCode(team.code)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                title="Copy team code"
                              >
                                <FaCopy className="text-xs text-gray-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">
                          Average Rating
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {Math.round(team.averageElo || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            <FaUsers className="inline mr-1" /> Members:
                          </span>
                          {editingSize && isCaptain(team) ? (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={
                                    team.maxSize === 2 ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    handleUpdateTeamSize(team.id, 2)
                                  }
                                  disabled={team.members.length > 2}
                                >
                                  2
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    team.maxSize === 4 ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    handleUpdateTeamSize(team.id, 4)
                                  }
                                  disabled={team.members.length > 4}
                                >
                                  4
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingSize(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {team.members?.length || 0} /{" "}
                                {team.maxSize || 4}
                              </Badge>
                              {isCaptain(team) && team.members.length === 0 && (
                                <button
                                  onClick={() => setEditingSize(true)}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit team size"
                                >
                                  <FaEdit className="text-xs text-gray-400" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team Matchmaking */}
                      <div className="mt-4">
                        <TeamMatchmaking team={team} user={user} />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(team.members || []).map((member: TeamMember) => (
                          <Badge
                            key={member.userId}
                            className="bg-white text-gray-700 border border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-all group relative"
                            onClick={() =>
                              handleViewMemberProfile(member.userId, team)
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              {member.userId === team.captainId && (
                                <FaCrown className="text-yellow-500" />
                              )}
                              <span className="font-medium">
                                {member.displayName}
                              </span>
                              <span className="text-xs">
                                ({Math.round(member.elo)})
                              </span>
                            </div>
                            {isCaptain(team) &&
                              member.userId !== team.captainId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMember(team.id, member.userId);
                                  }}
                                  className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove member"
                                >
                                  <FaTimes />
                                </button>
                              )}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        {isCaptain(team) ? (
                          <Button
                            onClick={() => handleDeleteTeam(team.id)}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                          >
                            <FaTrash className="mr-2" />
                            Delete Team
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleLeaveTeam(team.id)}
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <FaSignOutAlt className="mr-2" />
                            Leave Team
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Profile Dialog */}
      <Dialog open={isMemberProfileOpen} onOpenChange={setIsMemberProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
            <DialogDescription>
              View member details and statistics
            </DialogDescription>
          </DialogHeader>
          {memberProfile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={memberProfile.avatarUrl} />
                  <AvatarFallback>
                    {memberProfile.displayName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">
                    {memberProfile.displayName}
                  </h3>
                  <p className="text-sm text-gray-500">{memberProfile.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">
                    Rating
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(memberProfile.rating)}
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">RD</div>
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(memberProfile.rd)}
                  </div>
                </div>
              </div>
              {memberProfile.bio && (
                <div>
                  <div className="text-sm font-medium mb-1">Bio</div>
                  <p className="text-sm text-muted-foreground">
                    {memberProfile.bio}
                  </p>
                </div>
              )}

              {/* Captain Actions */}
              {selectedMember &&
                selectedMember.teamId &&
                userTeams &&
                userTeams.find((t) => t.id === selectedMember.teamId) && (
                  <div className="pt-4 border-t border-border space-y-2">
                    {isCaptain(
                      userTeams.find((t) => t.id === selectedMember.teamId) ||
                        null
                    ) && (
                      <>
                        {selectedMember.memberUserId !==
                          (userTeams.find((t) => t.id === selectedMember.teamId)
                            ?.captainId || "") && (
                          <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => {
                              handleRemoveMember(
                                selectedMember.teamId,
                                selectedMember.memberUserId
                              );
                              setIsMemberProfileOpen(false);
                            }}
                          >
                            <FaTimes className="mr-2" />
                            Remove Member from Team
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Available Teams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaSearch />
            Available Teams to Join
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!availableTeams || availableTeams.length === 0 ? (
            <div className="text-center py-12">
              <FaSearch className="text-6xl mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg mb-2">No teams available</p>
              <p className="text-gray-400 text-sm">
                Be the first to create a team!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableTeams.map((team) => {
                const memberCount = team.members?.length || 0;
                const capacity = 4;
                const isFull = memberCount >= capacity;

                return (
                  <div
                    key={team.id}
                    className={`group relative overflow-hidden p-5 rounded-lg border transition-all ${
                      isFull
                        ? "bg-muted border-border opacity-60"
                        : "bg-card border-border hover:border-primary hover:shadow-md"
                    }`}
                  >
                    <div className="relative">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-xl text-foreground">
                              {team.name}
                            </h3>
                            {isFull && (
                              <Badge
                                variant="destructive"
                                className="border-destructive"
                              >
                                Full
                              </Badge>
                            )}
                            {!isFull && (
                              <Badge
                                variant="secondary"
                                className="border-primary"
                              >
                                Open
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <FaCrown className="text-primary" />
                              <span className="font-medium">
                                {team.captainEmail}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FaChartLine className="text-primary" />
                              <span className="font-medium">
                                Avg: {Math.round(team.averageElo || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-muted-foreground mb-1">
                            Members ({team.maxSize || capacity})
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {memberCount}/{team.maxSize || capacity}
                          </div>
                        </div>
                      </div>

                      {memberCount > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="text-xs text-muted-foreground mb-2">
                            Current Members:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(team.members || []).map((member: TeamMember) => (
                              <Badge
                                key={member.userId}
                                variant="secondary"
                                className="text-xs"
                              >
                                {member.displayName} ({Math.round(member.elo)})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={() => handleJoinTeam(team.id)}
                        disabled={isFull || isUserInTeam}
                        className="flex-1"
                        variant={isFull ? "secondary" : "default"}
                      >
                        {isFull ? "Team Full" : "Join Team"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamBuilder;
