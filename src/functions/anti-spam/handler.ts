import { getModelForClass } from "@typegoose/typegoose";
import { logger, container } from "@yuudachi/framework";
import { Client, type Snowflake } from "discord.js";
import type { Redis } from "ioredis";
import { cases } from "../../models/cases.js";
import { kRedis } from "../../tokens.js";
import { MENTION_THRESHOLD, SPAM_THRESHOLD } from "../../util/constants.js";
import { type Case, CaseAction, createCase } from "../cases/createCase.js";
import { upsertCaseLog } from "../logging/upsertCaseLog.js";
import { checkLogChannel } from "../settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../settings/getGuildSetting.js";
import { createContentHash, totalContents } from "./totalContents.js";
import { totalMentions } from "./totalMentions.js";

export async function handleAntiSpam(
	this: any,
	guildId: Snowflake,
	userId: Snowflake,
	content: string,
	event: { event: string; name: string },
): Promise<void> {
	const client = container.resolve<Client<true>>(Client);
	const redis = container.resolve<Redis>(kRedis);
	const mongo = getModelForClass(cases);

	const guild = client.guilds.resolve(guildId);

	if (!guild) {
		return;
	}

	const modLogChannel = checkLogChannel(guild, await getGuildSetting(guildId, SettingsKeys.ModLogChannelId));

	if (!modLogChannel) {
		return;
	}

	const member = await guild.members.fetch(userId);

	if (!member.bannable) {
		return;
	}

	const totalMentionCount = await totalMentions(guildId, userId, content);
	const totalContentCount = await totalContents(guildId, userId, content);

	const mentionExceeded = totalMentionCount >= MENTION_THRESHOLD;
	const contentExceeded = totalContentCount >= SPAM_THRESHOLD;

	if (mentionExceeded || contentExceeded) {
		await redis.setex(`guild:${guildId}:user:${userId}:ban`, 15, "");

		let case_: Case | null = null;
		if (mentionExceeded) {
			logger.info(
				{
					event,
					guildId,
					userId: client.user.id,
					memberId: userId,
					mentionExceeded,
				},
				`Member ${userId} banned (mention spam)`,
			);

			case_ = await createCase(guild, {
				caseId: (await mongo.nextCase(guildId)) as unknown as number,
				targetId: userId,
				guildId,
				action: CaseAction.Ban,
				targetTag: member.user.tag,
				modId: client.user.id,
				modTag: client.user.tag,
				reason: "Mention spam detection",
				deleteMessageDays: 1,
			});

			await redis.del(`guild:${guildId}:user:${userId}:mentions`);
		} else if (contentExceeded) {
			logger.info(
				{
					event,
					guildId,
					userId: client.user.id,
					memberId: userId,
				},
				`Member ${userId} softbanned (spam)`,
			);

			await redis.setex(`guild:${guildId}:user:${userId}:unban`, 15, "");

			case_ = await createCase(guild, {
				caseId: (await mongo.nextCase(guildId)) as unknown as number,
				targetId: userId,
				guildId,
				action: CaseAction.Softban,
				targetTag: member.user.tag,
				modId: client.user.id,
				modTag: client.user.tag,
				reason: "Spam detection",
				deleteMessageDays: 1,
			});

			const contentHash = createContentHash(content);

			await redis.del(`guild:${guildId}:user:${userId}:contenthash:${contentHash}`);
		}

		await upsertCaseLog(guild, client.user, case_!);
	}
}
