const GITHUB_API = 'https://api.github.com';

function getEnv(key: string): string {
  const raw = process.env[key];
  if (!raw) throw new Error(`Missing environment variable: ${key}`);
  // Vercel UI 등에서 복붙 시 흔히 섞이는 따옴표/공백/줄바꿈을 제거
  return raw.trim().replace(/^["']|["']$/g, '');
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getEnv('GITHUB_PAT')}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function repoUrl(path: string): string {
  const owner = getEnv('GITHUB_REPO_OWNER');
  const repo = getEnv('GITHUB_REPO_NAME');
  return `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
}

export interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
  download_url: string;
}

export async function getFileContent(path: string): Promise<GitHubFileResponse> {
  const res = await fetch(repoUrl(path), { headers: headers() });
  if (!res.ok) {
    throw new Error(`GitHub GET ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<GitHubFileResponse>;
}

export async function createFile(
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const body = JSON.stringify({
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: 'main',
  });
  const res = await fetch(repoUrl(path), {
    method: 'PUT',
    headers: headers(),
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT (create) ${path}: ${res.status} - ${text}`);
  }
}

export async function updateFile(
  path: string,
  content: string,
  sha: string,
  message: string,
): Promise<void> {
  const body = JSON.stringify({
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha,
    branch: 'main',
  });
  const res = await fetch(repoUrl(path), {
    method: 'PUT',
    headers: headers(),
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT (update) ${path}: ${res.status} - ${text}`);
  }
}

export async function deleteFile(
  path: string,
  sha: string,
  message: string,
): Promise<void> {
  const body = JSON.stringify({
    message,
    sha,
    branch: 'main',
  });
  const res = await fetch(repoUrl(path), {
    method: 'DELETE',
    headers: headers(),
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub DELETE ${path}: ${res.status} - ${text}`);
  }
}

export async function getRawContent(path: string): Promise<string> {
  const file = await getFileContent(path);
  // Files > 1MB: GitHub omits content, use download_url instead
  if (file.content) {
    return Buffer.from(file.content, 'base64').toString('utf-8');
  }
  if (file.download_url) {
    const res = await fetch(file.download_url);
    if (!res.ok) throw new Error(`GitHub download ${path}: ${res.status}`);
    return res.text();
  }
  throw new Error(`GitHub GET ${path}: no content or download_url`);
}
