import { addFields } from "@yuudachi/framework";
import type { User } from "discord.js";
import type { Case } from "../cases/createCase.js";
import { generateCaseColor } from "./generateCaseColor.js";
import { generateCaseLog } from "./generateCaseLog.js";

export async function generateCaseEmbed(user: User | null | undefined, case_: Case) {
	let embed = addFields({
		color: generateCaseColor(case_),
		description: await generateCaseLog(case_),
		footer: {
			text: `Case ${case_.caseId}`,
		},
		timestamp: new Date(case_.createdAt).toISOString(),
	});

	if (user) {
		embed = {
			...embed,
			author: {
				name: `${user.tag} (${user.id})`,
				icon_url: user.displayAvatarURL(),
			},
		};
	}

	return embed;
}
