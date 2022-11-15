/* eslint-disable @typescript-eslint/no-use-before-define */
import { getModelForClass } from "@typegoose/typegoose";
import { logger, addFields, truncate, EMBED_DESCRIPTION_LIMIT } from "@yuudachi/framework";
import { oneLine } from "common-tags";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import {
	type CommandInteraction,
	type ButtonInteraction,
	type GuildMember,
	type SelectMenuInteraction,
	type User,
	type APIEmbed,
	hyperlink,
	inlineCode,
	time,
	TimestampStyles,
	messageLink,
} from "discord.js";
import { getGuildSetting, SettingsKeys } from "../functions/settings/getGuildSetting.js";
import { cases } from "../models/cases.js";
import { Color, HISTORY_DESCRIPTION_MAX_LENGTH, ThreatLevelColor } from "../util/constants.js";
import { ACTION_KEYS } from "./actionKeys.js";

dayjs.extend(relativeTime);

type CaseFooter = {
	[key: string]: number | undefined;
	ban?: number | undefined;
	kick?: number | undefined;
	mute?: number | undefined;
	timeout?: number | undefined;
	warn?: number | undefined;
};

const colors = [
	ThreatLevelColor.Level0,
	ThreatLevelColor.Level1,
	ThreatLevelColor.Level2,
	ThreatLevelColor.Level3,
	ThreatLevelColor.Level4,
	ThreatLevelColor.Level5,
	ThreatLevelColor.Level6,
	ThreatLevelColor.Level7,
];

type HistoryRecord = {
	created: Date;
	description?: string;
	identifierLabel: string;
	identifierURL?: string;
	label: string;
};

const mongo = getModelForClass(cases);

function generateHistoryEmbed(
	author: User,
	title: string,
	color: number,
	records: HistoryRecord[],
	footerText: string,
): APIEmbed {
	const descriptionParts = [];
	const truncatePhrase = "and more...";

	if (!records.length) {
		descriptionParts.push("`No history found`");
	}

	for (const record of records) {
		const dateFormatted = time(dayjs(record.created).unix(), TimestampStyles.ShortDate);
		const recordString = `${dateFormatted} ${inlineCode(record.label)} ${
			record.identifierURL ? hyperlink(record.identifierLabel, record.identifierURL) : record.identifierLabel
		} ${
			record.description
				? truncate(oneLine(record.description.replaceAll("*", "")), HISTORY_DESCRIPTION_MAX_LENGTH, "")
				: ""
		}`;

		if (
			descriptionParts.join("\n").length + recordString.length + 1 <
			EMBED_DESCRIPTION_LIMIT - truncatePhrase.length
		) {
			descriptionParts.push(recordString);
		} else {
			descriptionParts.push(truncatePhrase);
		}
	}

	return {
		author: {
			name: `${author.tag} (${author.id})`,
			icon_url: author.displayAvatarURL(),
		},
		title,
		color,
		description: descriptionParts.join("\n"),
		footer: {
			text: footerText,
		},
	};
}

function actionKeyLabel(key: typeof ACTION_KEYS[number]) {
	switch (key) {
		case "warn":
			return "WARN";
		case "kick":
			return "KICK";
		case "softban":
			return "SOFTBAN";
		case "ban":
			return "BAN";
		case "unban":
			return "UNBAN";
		case "timeout":
			return "TIMEOUT";
		default:
			return "UNKNOWN";
	}
}

function actionSummary(warns: number, kicks: number, softbans: number, bans: number, unbans: number, timeouts: number) {
	return [
		`${warns} warnings`,
		`${kicks} kicks`,
		`${softbans} softbans`,
		`${bans} bans`,
		`${unbans} unbans`,
		`${timeouts} timeouts`,
	].join(", ");
}

export async function generateCaseHistory(
	interaction: ButtonInteraction<"cached"> | CommandInteraction<"cached"> | SelectMenuInteraction<"cached">,
	target: { member?: GuildMember | undefined; user: User },
) {
	const moduleLogChannelId = await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId);

	const cases = await mongo
		.find({ guild_id: interaction.guildId, target_id: target.user.id, action: { $nin: [1, 8] } })
		.sort({ created_at: -1 });

	const caseCounter = cases.reduce((count: CaseFooter, case_) => {
		const action = ACTION_KEYS[case_.action]!;
		count[action] = (count[action] ?? 0) + 1;
		return count;
	}, {});

	const values: [number, number, number, number, number, number] = [
		caseCounter.unban ?? 0,
		caseCounter.warn ?? 0,
		caseCounter.kick ?? 0,
		caseCounter.softban ?? 0,
		caseCounter.ban ?? 0,
		caseCounter.timeout ?? 0,
	];
	const colorIndex = Math.min(
		values.reduce((a, b) => a + b),
		colors.length - 1,
	);

	const records: HistoryRecord[] = cases.map((case_) => {
		return {
			created: case_.created_at,
			identifierLabel: `#${case_.case_id}`,
			identifierURL: messageLink(moduleLogChannelId, case_.context_message_id, case_.guild_id),
			label: actionKeyLabel(ACTION_KEYS[case_.action]!),
			description: case_.reason ?? undefined,
		};
	});

	return generateHistoryEmbed(
		target.user,
		"Case History",
		colors[colorIndex] ?? Color.DiscordEmbedBackground,
		records,
		actionSummary(...values),
	);
}

export function generateUserInfo(target: { member?: GuildMember | undefined; user: User }) {
	const sinceCreationFormatted = time(dayjs(target.user.createdTimestamp).unix(), TimestampStyles.RelativeTime);
	const creationFormatted = time(dayjs(target.user.createdTimestamp).unix(), TimestampStyles.ShortDateTime);

	let embed = addFields(
		{
			author: {
				name: `${target.user.tag} (${target.user.id})`,
				icon_url: target.user.displayAvatarURL(),
			},
			color: Color.DiscordEmbedBackground,
		},
		{
			name: "User details",
			value: `• Username: ${target.user.toString()} - \`${target.user.tag}\` (${
				target.user.id
			})\n• Created: ${creationFormatted} (${sinceCreationFormatted}) \`${target.user.createdTimestamp}\``,
		},
	);

	if (target.member?.joinedTimestamp) {
		const sinceJoinFormatted = time(dayjs(target.member.joinedTimestamp).unix(), TimestampStyles.RelativeTime);
		const joinFormatted = time(dayjs(target.member.joinedTimestamp).unix(), TimestampStyles.ShortDateTime);

		const memberDescriptionParts = [];
		const nonDefaultRoles = target.member.roles.cache.filter((role) => role.id !== role.guild.roles.everyone.id);

		if (target.member.nickname) {
			memberDescriptionParts.push(`• Nickname: \`${target.member.nickname}\``);
		}

		if (nonDefaultRoles.size) {
			memberDescriptionParts.push(
				`• Roles (${nonDefaultRoles.size}): ${nonDefaultRoles.map((role) => role.toString())}`,
			);
		}

		memberDescriptionParts.push(
			`• Joined: ${joinFormatted} (${sinceJoinFormatted}) \`${target.member.joinedTimestamp}\``,
		);

		embed = addFields(embed, {
			name: "Member details",
			value: memberDescriptionParts.join("\n"),
		});
	}

	return embed;
}

export enum HistoryType {
	Case,
}

export async function generateHistory(
	interaction: ButtonInteraction<"cached"> | CommandInteraction<"cached"> | SelectMenuInteraction<"cached">,
	target: { member?: GuildMember | undefined; user: User },
	type = HistoryType.Case,
) {
	let embed = generateUserInfo(target);

	switch (type) {
		case HistoryType.Case: {
			embed = {
				...embed,
				...(await generateCaseHistory(interaction, target)),
			};
			break;
		}

		default: {
			logger.warn(`Unhandled history type: ${HistoryType[type]} (${type})`);
		}
	}

	if (!embed.color) {
		embed.color = Color.DiscordEmbedBackground;
	}

	return embed;
}
