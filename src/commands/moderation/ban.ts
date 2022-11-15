import { getModelForClass } from "@typegoose/typegoose";
import { Command, logger, createButton, truncateEmbed, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ButtonStyle, ComponentType } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { CaseAction, createCase } from "../../functions/cases/createCase.js";
import { generateCasePayload } from "../../functions/logging/generateCasePayload.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { BanCommand } from "../../interactions/index.js";
import { cases } from "../../models/cases.js";
import { kRedis } from "../../tokens.js";
import { CASE_REASON_MAX_LENGTH } from "../../util/constants.js";
import { generateHistory } from "../../util/generateHistory.js";

@injectable()
export default class extends Command<typeof BanCommand> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super();
	}

	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof BanCommand>): Promise<void> {
		const reply = await interaction.deferReply({ ephemeral: true });

		const mongo = getModelForClass(cases);
		const modLogChannel = checkLogChannel(
			interaction.guild,
			await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId),
		);

		if (!modLogChannel) {
			throw new Error("No mod log channel has been initialized yet.");
		}

		let alreadyBanned = false;
		try {
			await interaction.guild.bans.fetch(args.user.user.id);
			alreadyBanned = true;
		} catch {}

		if (alreadyBanned) {
			throw new Error(`${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id}) is already banned.`);
		}

		if (args.user.member && !args.user.member.bannable) {
			throw new Error(
				`Missing permissions to ban ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
			);
		}

		if (args.reason && args.reason.length >= CASE_REASON_MAX_LENGTH) {
			throw new Error(`Maximum length of \`${CASE_REASON_MAX_LENGTH}\` for reason exceeded.`);
		}

		const banKey = nanoid();
		const cancelKey = nanoid();

		const banButton = createButton({
			label: "Ban",
			customId: banKey,
			style: ButtonStyle.Danger,
		});
		const cancelButton = createButton({
			label: "Cancel",
			customId: cancelKey,
			style: ButtonStyle.Secondary,
		});

		const embed = truncateEmbed(await generateHistory(interaction, args.user));

		await interaction.editReply({
			content: `Do you really want to ban ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})?`,
			embeds: [embed],
			components: [createMessageActionRow([cancelButton, banButton])],
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
						content: "Actiont timer ran out.",
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
				content: `Canceled ban on ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		} else if (collectedInteraction?.customId === banKey) {
			await collectedInteraction.deferUpdate();

			await this.redis.setex(`guild:${collectedInteraction.guildId}:user:${args.user.user.id}:ban`, 15, "");
			const case_ = await createCase(
				collectedInteraction.guild,
				generateCasePayload({
					guildId: collectedInteraction.guildId,
					user: collectedInteraction.user,
					caseId: await mongo.nextCase(collectedInteraction.guildId),
					args: {
						...args,
						days: Math.min(Math.max(Number(args.days ?? 0), 0), 7),
					},
					action: CaseAction.Ban,
				}),
			);
			await upsertCaseLog(collectedInteraction.guild, collectedInteraction.user, case_);

			await collectedInteraction.editReply({
				content: `Successfully banned ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		}
	}
}
