import { Command } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { commitInfo } from "../../functions/github/commit.js";
import { githubInfo, validateGitHubName } from "../../functions/github/github.js";
import type { GitHubAPIResult } from "../../functions/github/githubInterface.js";
import { issueInfo } from "../../functions/github/issue.js";
import type { GithubCommand } from "../../interactions/index.js";
import { DEFAULT_REPO, DEFAULT_REPO_OWNER, GITHUB_EMOJI_COMMIT } from "../../util/constants.js";

export default class extends Command<typeof GithubCommand> {
	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof GithubCommand>): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const [owner, repository, expression] = await githubInfo(
			args.owner ?? DEFAULT_REPO_OWNER,
			args.repository ?? DEFAULT_REPO,
			args.query,
		);

		if (!validateGitHubName(owner)) {
			throw new Error(`Invalid repository owner name: \`${owner}\`.`);
		}

		if (!validateGitHubName(repository)) {
			throw new Error(`Invalid repository name: \`${repository}\`.`);
		}

		if (Number.isNaN(Number(expression))) {
			const res = (await commitInfo(owner, repository, expression)) as GitHubAPIResult;

			if (!res.data) {
				throw new Error(
					`GitHub fetching unsuccessful. Arguments: \`owner: ${owner}\`, \`repository: ${repository}\`, \`expression: ${expression}\``,
				);
			}

			// eslint-disable-next-line id-length
			if (res.errors?.some((e) => e.type === "NOT_FOUND") || !res.data?.repository?.object) {
				throw new Error(`Could not find commit \`${expression}\` on the repository \`${owner}/${repository}\`.`);
			}

			const commit = res.data?.repository?.object;
			// eslint-disable-next-line unicorn/numeric-separators-style
			await interaction.editReply({
				content: `${GITHUB_EMOJI_COMMIT} [${commit?.abbreviatedOid} in ${commit?.repository.nameWithOwner}](<${
					commit?.commitUrl ?? ""
				}>) by [${commit?.author.user?.login ?? commit?.author.name ?? ""}](<${commit?.author.user?.url ?? ""}>) ${
					commit?.pushedDate ? `committed <t:${Math.floor(new Date(commit.pushedDate).getTime() / 1_000)}:R>` : ""
				} \n${commit?.messageHeadline ?? ""}`,
			});
		}

		await interaction.editReply({
			content: await issueInfo(owner, repository, expression),
		});
	}
}
