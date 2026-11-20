"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  LogOut,
  MailPlus,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { TeamInviteInfo, TeamSummary } from "@/lib/typography/library-store";
import type { TeamMemberRole } from "@/lib/typography/custom-tree";

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  owner: "所有者",
  editor: "编辑者（可维护团队库）",
  member: "使用者（可应用与复制到个人库）",
};

export interface TeamManagerPanelProps {
  onChanged?: () => void;
}

export function TeamManagerPanel({ onChanged }: TeamManagerPanelProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<TeamInviteInfo[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteInputs, setInviteInputs] = useState<
    Record<string, { email: string; role: "editor" | "member" }>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setAuthenticated(Boolean(data.authenticated));
      setTeams(Array.isArray(data.teams) ? (data.teams as TeamSummary[]) : []);
      setIncomingInvites(
        Array.isArray(data.incomingInvites) ? (data.incomingInvites as TeamInviteInfo[]) : [],
      );
    } catch {
      setError("加载团队信息失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  async function postTeamAction(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "操作失败。");
      }
      setNotice(successMsg);
      await loadTeams();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="py-6 text-center text-xs text-neutral-500">正在加载团队与邀请信息…</p>;
  }

  if (!authenticated) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-center text-xs text-neutral-600">
        登录后可创建协作团队、按已注册邮箱发起站内邀请，以及共享团队模板与素材库。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
          {notice}
        </p>
      )}

      {/* 收到的站内邀请 */}
      {incomingInvites.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <h3 className="text-xs font-semibold text-emerald-950">
            待处理的团队邀请（{incomingInvites.length}）
          </h3>
          <div className="mt-2.5 space-y-2">
            {incomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3.5 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-neutral-950">「{inv.teamName}」</span>
                  <span className="ml-2 text-neutral-600">
                    邀请您成为 <strong>{ROLE_LABELS[inv.role]}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void postTeamAction(
                        { action: "respond-invite", inviteId: inv.id, decision: "accept" },
                        `已加入团队「${inv.teamName}」`,
                      )
                    }
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-800 px-3 py-1 font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                  >
                    <Check size={13} />
                    接受邀请
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void postTeamAction(
                        { action: "respond-invite", inviteId: inv.id, decision: "decline" },
                        "已婉拒该团队邀请",
                      )
                    }
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 创建新团队 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTeamName.trim()) return;
          const targetName = newTeamName.trim();
          setNewTeamName("");
          void postTeamAction({ action: "create-team", name: targetName }, `已创建团队「${targetName}」`);
        }}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3.5"
      >
        <Users size={16} className="text-neutral-500" />
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="输入新团队名称（例如：品牌内容组）"
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !newTeamName.trim()}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          <Plus size={14} />
          新建团队
        </button>
      </form>

      {/* 已加入团队列表 */}
      {teams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
          您尚未加入任何团队。可新建团队后按已注册邮箱邀请同事共享公众号模板与素材。
        </p>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const isOwner = team.myRole === "owner";
            const invInput = inviteInputs[team.id] ?? { email: "", role: "editor" };
            return (
              <div key={team.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-950">{team.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                      <Shield size={11} />
                      我的角色：{ROLE_LABELS[team.myRole]}
                    </span>
                  </div>
                  {!isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void postTeamAction(
                          { action: "remove-member", teamId: team.id },
                          `已退出团队「${team.name}」，此前应用到稿件的素材仍可继续使用`,
                        )
                      }
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <LogOut size={12} />
                      退出团队
                    </button>
                  )}
                </div>

                {/* 成员列表 */}
                <div className="mt-3 divide-y divide-neutral-100">
                  {team.members.map((mem) => (
                    <div
                      key={mem.userId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{mem.email}</span>
                        {mem.role === "owner" && (
                          <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            所有者
                          </span>
                        )}
                      </div>

                      {isOwner && mem.role !== "owner" ? (
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`调整 ${mem.email} 的团队角色`}
                            value={mem.role}
                            disabled={busy}
                            onChange={(e) =>
                              void postTeamAction(
                                {
                                  action: "update-role",
                                  teamId: team.id,
                                  targetUserId: mem.userId,
                                  role: e.target.value,
                                },
                                `已更新 ${mem.email} 的角色`,
                              )
                            }
                            className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-900"
                          >
                            <option value="editor">编辑者（维护团队库）</option>
                            <option value="member">使用者（仅使用与复制）</option>
                          </select>
                          <button
                            type="button"
                            aria-label={`移除成员 ${mem.email}`}
                            disabled={busy}
                            onClick={() =>
                              void postTeamAction(
                                {
                                  action: "remove-member",
                                  teamId: team.id,
                                  targetUserId: mem.userId,
                                },
                                `已将 ${mem.email} 移出团队`,
                              )
                            }
                            className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-neutral-500">{ROLE_LABELS[mem.role]}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 所有者：按已注册邮箱发起站内邀请 & 管理待处理邀请 */}
                {isOwner && (
                  <div className="mt-3 space-y-2.5 border-t border-neutral-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="email"
                        value={invInput.email}
                        onChange={(e) =>
                          setInviteInputs((prev) => ({
                            ...prev,
                            [team.id]: { ...invInput, email: e.target.value },
                          }))
                        }
                        placeholder="输入对方已注册的邮箱发起站内邀请"
                        className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none"
                      />
                      <select
                        value={invInput.role}
                        onChange={(e) =>
                          setInviteInputs((prev) => ({
                            ...prev,
                            [team.id]: {
                              ...invInput,
                              role: e.target.value as "editor" | "member",
                            },
                          }))
                        }
                        className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-900"
                      >
                        <option value="editor">编辑者</option>
                        <option value="member">使用者</option>
                      </select>
                      <button
                        type="button"
                        disabled={busy || !invInput.email.trim()}
                        onClick={() => {
                          const targetEmail = invInput.email.trim();
                          setInviteInputs((prev) => ({
                            ...prev,
                            [team.id]: { ...invInput, email: "" },
                          }));
                          void postTeamAction(
                            {
                              action: "invite",
                              teamId: team.id,
                              email: targetEmail,
                              role: invInput.role,
                            },
                            `已向 ${targetEmail} 发出站内邀请，对方登录后即可接受`,
                          );
                        }}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
                      >
                        <MailPlus size={13} />
                        发送邀请
                      </button>
                    </div>

                    {team.pendingInvites.length > 0 && (
                      <div className="rounded-lg bg-neutral-50 p-2.5 text-[11px] text-neutral-600">
                        <div className="font-semibold text-neutral-800">待对方接受的邀请：</div>
                        <div className="mt-1 space-y-1">
                          {team.pendingInvites.map((pi) => (
                            <div key={pi.id} className="flex items-center justify-between gap-2">
                              <span>
                                {pi.email} · {ROLE_LABELS[pi.role]}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void postTeamAction(
                                    { action: "respond-invite", inviteId: pi.id, decision: "revoke" },
                                    `已撤回对 ${pi.email} 的邀请`,
                                  )
                                }
                                className="text-red-600 underline hover:text-red-800"
                              >
                                撤回
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TeamManagerDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-manager-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3.5">
          <h2 id="team-manager-dialog-title" className="text-base font-semibold text-neutral-950">
            团队与成员邀请管理
          </h2>
          <button
            type="button"
            aria-label="关闭团队管理弹窗"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <TeamManagerPanel onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}
