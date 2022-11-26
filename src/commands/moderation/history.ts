import { Command } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam, CommandMethod } from "@yuudachi/framework/types";
import type { HistoryCommand, HistoryUserContextCommand } from "../../interactions/index.js";
import { generateHistory } from "../../util/generateHistory.js";

export default class extends Command<typeof HistoryCommand | typeof HistoryUserContextCommand> {
	public constructor() {
		super(["history", "History"]);
	}

	private async handle(
		interaction: InteractionParam | InteractionParam<CommandMethod.UserContext>,
		args: ArgsParam<typeof HistoryCommand | typeof HistoryUserContextCommand>,
	): Promise<void> {
		const embed = await generateHistory(interaction, args.user);

		await interaction.editReply({
			embeds: [embed],
		});
	}

	public override async chatInput(
		interaction: InteractionParam,
		args: ArgsParam<typeof HistoryCommand>,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: args.hide ?? true });
		await this.handle(interaction, args);
	}

	public override async userContext(
		interaction: InteractionParam<CommandMethod.UserContext>,
		args: ArgsParam<typeof HistoryUserContextCommand>,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		await this.handle(interaction, args);
	}
}
