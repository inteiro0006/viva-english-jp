import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin/require-admin";

export type RepoStatus = {
  configured: boolean;
  /** owner/repo, when configured */
  repo: string | null;
  branch: string | null;
  htmlUrl: string | null;
  isPrivate: boolean | null;
  lastCommit: {
    sha: string;
    shortSha: string;
    message: string;
    author: string | null;
    committedAt: string | null;
    url: string | null;
  } | null;
  /** Timestamp of the last push to the repository (GitHub `pushed_at`). */
  lastPushAt: string | null;
  checkedAt: string;
  error: string | null;
};

/**
 * Read-only GitHub repository status (active branch + last commit + last push).
 * Requires GITHUB_REPOSITORY ("owner/repo"). GITHUB_TOKEN is optional and only
 * needed for private repositories or to raise the API rate limit.
 */
export const getRepositoryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RepoStatus> => {
    await assertAdmin(context);

    const checkedAt = new Date().toISOString();
    const empty: RepoStatus = {
      configured: false,
      repo: null,
      branch: null,
      htmlUrl: null,
      isPrivate: null,
      lastCommit: null,
      lastPushAt: null,
      checkedAt,
      error: null,
    };

    const repo = (process.env.GITHUB_REPOSITORY ?? "").trim();
    if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
      return empty;
    }

    const token = process.env.GITHUB_TOKEN?.trim();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "eigo-michi-admin",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      if (!repoRes.ok) {
        const body = await repoRes.text();
        return {
          ...empty,
          configured: true,
          repo,
          error: `GitHub API ${repoRes.status}: ${body.slice(0, 300)}`,
        };
      }
      const repoJson = (await repoRes.json()) as {
        default_branch: string;
        html_url: string;
        private: boolean;
        pushed_at: string | null;
      };

      const branch = repoJson.default_branch;
      const branchRes = await fetch(
        `https://api.github.com/repos/${repo}/branches/${encodeURIComponent(branch)}`,
        { headers },
      );

      let lastCommit: RepoStatus["lastCommit"] = null;
      if (branchRes.ok) {
        const branchJson = (await branchRes.json()) as {
          commit?: {
            sha?: string;
            html_url?: string;
            commit?: {
              message?: string;
              author?: { name?: string; date?: string };
            };
            author?: { login?: string };
          };
        };
        const c = branchJson.commit;
        if (c?.sha) {
          lastCommit = {
            sha: c.sha,
            shortSha: c.sha.slice(0, 7),
            message: (c.commit?.message ?? "").split("\n")[0],
            author: c.author?.login ?? c.commit?.author?.name ?? null,
            committedAt: c.commit?.author?.date ?? null,
            url: c.html_url ?? null,
          };
        }
      }

      return {
        configured: true,
        repo,
        branch,
        htmlUrl: repoJson.html_url,
        isPrivate: repoJson.private,
        lastCommit,
        lastPushAt: repoJson.pushed_at,
        checkedAt,
        error: null,
      };
    } catch (e) {
      return {
        ...empty,
        configured: true,
        repo,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  });
