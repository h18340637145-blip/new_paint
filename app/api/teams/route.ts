import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import {
  createTeam,
  inviteTeamMemberByEmail,
  listUserTeamsAndInvites,
  removeOrLeaveTeamMember,
  respondToTeamInvite,
  updateTeamMemberRole,
} from "@/lib/typography/library-store";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "团队操作失败，请稍后重试。" }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user || !user.email) {
      return NextResponse.json(
        { authenticated: false, teams: [], incomingInvites: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const admin = studioAdmin();
    const data = await listUserTeamsAndInvites(admin, user.id, user.email);
    return NextResponse.json(
      { authenticated: true, ...data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireStudioMember();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userEmail = user?.email ?? "";

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new StudioError("请求内容无效。", 400);
    }

    const admin = studioAdmin();
    const action = body.action;

    if (action === "create-team") {
      const team = await createTeam(admin, userId, typeof body.name === "string" ? body.name : "");
      return NextResponse.json({ team }, { status: 201 });
    }

    if (action === "invite") {
      const teamId = typeof body.teamId === "string" ? body.teamId : "";
      const email = typeof body.email === "string" ? body.email : "";
      const role = body.role === "editor" ? "editor" : "member";
      const invite = await inviteTeamMemberByEmail({
        admin,
        actorUserId: userId,
        teamId,
        email,
        role,
      });
      return NextResponse.json({ invite }, { status: 201 });
    }

    if (action === "respond-invite") {
      const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
      const decision =
        body.decision === "accept" || body.decision === "decline" || body.decision === "revoke"
          ? body.decision
          : null;
      if (!decision) throw new StudioError("无效的邀请操作。", 400);
      await respondToTeamInvite({
        admin,
        userId,
        userEmail,
        inviteId,
        decision,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "update-role") {
      const teamId = typeof body.teamId === "string" ? body.teamId : "";
      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
      const role = body.role === "editor" ? "editor" : "member";
      await updateTeamMemberRole({
        admin,
        actorUserId: userId,
        teamId,
        targetUserId,
        role,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "remove-member") {
      const teamId = typeof body.teamId === "string" ? body.teamId : "";
      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : userId;
      await removeOrLeaveTeamMember({
        admin,
        actorUserId: userId,
        teamId,
        targetUserId,
      });
      return NextResponse.json({ ok: true });
    }

    throw new StudioError("不支持的团队操作。", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
