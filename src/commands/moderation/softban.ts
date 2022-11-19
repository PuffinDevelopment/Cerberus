import { getModelForClass } from "@typegoose/typegoose";
import { Command, logger, createButton, truncateEmbed, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ButtonStyle, ComponentType } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { CASE_REASON_MAX_LENGTH } from "../../Constants.js";
import { CaseAction, createCase } from "../../functions/cases/createCase.js";
import { generateCasePayload } from "../../functions/logging/generateCasePayload.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { SoftbanCommand } from "../../interactions/index.js";
import { cases } from "../../models/cases.js";
import { kRedis } from "../../tokens.js";
import { generateHistory } from "../../util/generateHistory.js";

@injectable()
export default class extends Command<typeof SoftbanCommand> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super();
	}

	public override async chatInput(
		interaction: InteractionParam,
		args: ArgsParam<typeof SoftbanCommand>,
	): Promise<void> {
		const mongo = getModelForClass(cases);
		const reply = await interaction.deferReply({ ephemeral: true });

		const modLogChannel = checkLogChannel(
			interaction.guild,
			await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId),
		);

		if (!modLogChannel) {
			throw new Error("No mod log channel has been initialized yet.");
		}

		if (args.user.member && !args.user.member.bannable) {
			throw new Error(
				`Missing permissions to softban ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
			);
		}

		if (args.reason && args.reason.length >= CASE_REASON_MAX_LENGTH) {
			throw new Error(`Maximum length of \`${CASE_REASON_MAX_LENGTH}\` for reason exceeded.`);
		}

		const isStillMember = interaction.guild.members.resolve(args.user.user.id);

		const softbanKey = nanoid();
		const cancelKey = nanoid();

		const softbanButton = createButton({
			label: "Softban",
			customId: softbanKey,
			style: ButtonStyle.Danger,
		});
		const cancelButton = createButton({
			label: "Cancel",
			customId: cancelKey,
			style: ButtonStyle.Secondary,
		});

		const embeds = isStillMember ? [truncateEmbed(await generateHistory(interaction, args.user))] : [];

		await interaction.editReply({
			content: isStillMember
				? `Do you really want to softban ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})?`
				: `User ${args.user.user.toString()} - ${args.user.user.tag} (${
						args.user.user.id
				  }) is not on this guild. Do you still wish to softban them to remove messages?`,
			embeds,
			components: [createMessageActionRow([cancelButton, softbanButton])],
		});

		const collectedInteraction = await reply
			.awaitMessageComponent({
				filter: (collected) => collected.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: 15_000,
			})
			.catch(async () => {
				try {
					await interaction.editReply({
						content: "Action timer ran out.",
						components: [],
					});
				} catch (error_) {
					const error = error_ as Error;
					logger.error(error, error.message);
				}

				return undefined;
			});

		if (collectedInteraction?.customId === cancelKey) {
			await collectedInteraction.update({
				content: `Canceled softban on ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		} else if (collectedInteraction?.customId === softbanKey) {
			await collectedInteraction.deferUpdate();

			await this.redis.setex(`guild:${collectedInteraction.guildId}:user:${args.user.user.id}:ban`, 15, "");
			await this.redis.setex(`guild:${collectedInteraction.guildId}:user:${args.user.user.id}:unban`, 15, "");

			if (isStillMember) {
				const case_ = await createCase(
					collectedInteraction.guild,
					generateCasePayload({
						guildId: collectedInteraction.guildId,
						caseId: await mongo.nextCase(collectedInteraction.guildId),
						user: collectedInteraction.user,
						args: {
							...args,
							days: Math.min(Math.max(Number(args.days ?? 1), 0), 7),
						},
						action: CaseAction.Softban,
					}),
				);
				await upsertCaseLog(collectedInteraction.guild, collectedInteraction.user, case_);
			} else {
				const reason = `Mod: ${args.user.user.tag} | Softban to clear messages`;

				await interaction.guild.bans.create(args.user.user, {
					reason,
					deleteMessageDays: Math.min(Math.max(Number(args.days ?? 1), 0), 7),
				});
				await interaction.guild.bans.remove(args.user.user, reason);
			}

			await collectedInteraction.editReply({
				content: isStillMember
					? `Successfully softbanned ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`
					: `Successfully cleared messages from ${args.user.user.toString()} - ${args.user.user.tag} (${
							args.user.user.id
					  })`,
				components: [],
			});
		}
	}
}
