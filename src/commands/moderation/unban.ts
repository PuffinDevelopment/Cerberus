import { Command, logger, createButton, truncateEmbed, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ButtonStyle, ComponentType } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { CASE_REASON_MAX_LENGTH } from "../../Constants.js";
import { deleteCase } from "../../functions/cases/deleteCase.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { UnbanCommand } from "../../interactions/index.js";
import { kRedis } from "../../tokens.js";
import { generateHistory } from "../../util/generateHistory.js";

@injectable()
export default class extends Command<typeof UnbanCommand> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super();
	}

	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof UnbanCommand>): Promise<void> {
		const reply = await interaction.deferReply({ ephemeral: true });

		const modLogChannel = checkLogChannel(
			interaction.guild,
			await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId),
		);

		if (!modLogChannel) {
			throw new Error("No mod log channel has been initialized yet.");
		}

		try {
			await interaction.guild.bans.fetch(args.user.user.id);
		} catch {
			throw new Error(`${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id}) is not banned.`);
		}

		if (args.reason && args.reason.length >= CASE_REASON_MAX_LENGTH) {
			throw new Error(`Maximum length of \`${CASE_REASON_MAX_LENGTH}\` for reason exceeded.`);
		}

		const unbanKey = nanoid();
		const cancelKey = nanoid();

		const unbanButton = createButton({
			label: "Unban",
			customId: unbanKey,
			style: ButtonStyle.Danger,
		});
		const cancelButton = createButton({
			label: "Cancel",
			customId: cancelKey,
			style: ButtonStyle.Secondary,
		});

		const embed = truncateEmbed(await generateHistory(interaction, args.user));

		await interaction.editReply({
			content: `Do you really want to unban ${args.user.user.toString()} - ${args.user.user.tag} (${
				args.user.user.id
			})?`,
			embeds: [embed],
			components: [createMessageActionRow([cancelButton, unbanButton])],
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
				content: `Canceled unban on ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		} else if (collectedInteraction?.customId === unbanKey) {
			await collectedInteraction.deferUpdate();

			await this.redis.setex(`guild:${collectedInteraction.guildId}:user:${args.user.user.id}:unban`, 15, "");
			const case_ = await deleteCase({
				guild: collectedInteraction.guild,
				user: collectedInteraction.user,
				target: args.user.user,
				reason: args.reason,
				manual: true,
			});
			await upsertCaseLog(collectedInteraction.guild, collectedInteraction.user, case_);

			await collectedInteraction.editReply({
				content: `Successfully unbanned ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		}
	}
}
