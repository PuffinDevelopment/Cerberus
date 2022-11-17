import process from "node:process";
import fetch from "node-fetch";
import { GITHUB_BASE_URL } from "../../util/constants.js";
import type { GitHubAPIResult } from "./githubInterface.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function buildQuery(owner: string, repository: string, expression: string) {
	return `
		{
			repository(owner: "${owner}", name: "${repository}") {
				object(expression: "${expression}") {
					... on Commit {
						repository {
							nameWithOwner
						}
						messageHeadline
						abbreviatedOid
						commitUrl
						pushedDate
						author {
							name
							user {
								login
								url
							}
						}
					}
				}
			}
		}`;
}

export async function commitInfo(owner: string, repository: string, expression: string) {
	const query = buildQuery(owner, repository, expression);

	const res: GitHubAPIResult = await fetch(GITHUB_BASE_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${GITHUB_TOKEN}`, // eslint-disable-line @typescript-eslint/naming-convention
		},
		body: JSON.stringify({ query }),
		// eslint-disable-next-line @typescript-eslint/method-signature-style
	}).then((res: { json: () => any }) => res.json());

	return res;
}
