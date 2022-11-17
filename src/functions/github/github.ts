/* eslint-disable no-param-reassign */

export function validateGitHubName(name: string): boolean {
	// eslint-disable-next-line unicorn/better-regex
	const reg = /[A-Za-z0-9_.-]+/;
	const match = reg.exec(name);
	return Boolean(match?.length);
}

export async function githubInfo(owner: string, repository: string, expression: string) {
	// eslint-disable-next-line prefer-named-capture-group, unicorn/better-regex, unicorn/no-unsafe-regex
	const re = /(?:https?:\/\/github\.com)?\/?(.*?)\/(.*?)\/.*?\/(.[a-zA-Z0-9]*)/;
	const res = re.exec(expression);
	if (res) {
		// eslint-disable-next-line id-length
		const [, o, r, q] = res;
		owner = o as string;
		repository = r as string;
		expression = q as string;
	}

	return [owner, repository, expression] as const;
}
