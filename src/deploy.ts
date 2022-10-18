import "reflect-metadata";
import process from "node:process";
import { logger } from "@yuudachi/framework";
import { Routes, REST } from "discord.js";
import {
	UserInfoCommand,
	UserInfoContextCommand,
} from "./interactions/index.js";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

try {
	logger.info("Start refreshing interaction (/) commands.");

	const body: unknown[] = [
		UserInfoCommand,
		UserInfoContextCommand,
	];

	await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_GUILD_ID!), {
		body,
	});

	logger.info("Successfully reloaded interaction commands.");
} catch (error_) {
	const error = error_ as Error;
	logger.error(error.message, error);
}
