import type { AutocompleteInteraction } from "discord.js";
import { findBestMatch } from "../../util/findBestMatch.js";

export function checkReasonAutocomplete(interaction: AutocompleteInteraction) {
	return interaction.options.getFocused(true).name === "reason";
}

export async function handleAutocompleteReasons(interaction: AutocompleteInteraction): Promise<void> {
	const input = interaction.options.getString("reason", true);

	const reasons = [
		"Troll",
		"Rude",
		"Slurs",
		"Suspicious scam or spam account",
		"Off-topic",
		"NSFW",
		"Shitpost",
		"Insults",
		"DM harassment",
		"ToS violation",
		"Selfbot",
		"COPPA",
	];

	const matches = findBestMatch(input, reasons);

	const mappedReasons = matches.map((name) => ({ name, value: name }));

	await interaction.respond(mappedReasons);
}
