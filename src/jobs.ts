import { getModelForClass } from "@typegoose/typegoose";
import { logger, container } from "@yuudachi/framework";
import type { RedisClient, Job } from "bullmq";
import { Queue, Worker } from "bullmq";
import { Client } from "discord.js";
import type { Redis } from "ioredis";
import { deleteCase } from "./functions/cases/deleteCase.js";
import { upsertCaseLog } from "./functions/logging/upsertCaseLog.js";
import { cases } from "./models/cases.js";
import { kRedis } from "./tokens.js";

export async function registerJobs() {
	const client = container.resolve<Client<true>>(Client);
	const redis = container.resolve<Redis>(kRedis);
	const mongo = getModelForClass(cases);

	const queue = new Queue("jobs", { connection: redis as unknown as RedisClient });

	try {
		logger.info({ job: { name: "modActionTimers" } }, "Registering job: modActionTimers");
		await queue.add("modActionTimers", {}, { repeat: { cron: "* * * * *" } });
		logger.info({ job: { name: "modActionTimers" } }, "Registered job: modActionTimers");

		new Worker(
			"jobs",
			async (job: Job) => {
				switch (job.name) {
					case "modActionTimers": {
						const currentCases = await mongo
							.find({
								action_processed: false,
							})
							.select("guild_id case_id action_expiration");

						for (const case_ of currentCases) {
							if (Date.parse(case_.action_expiration as unknown as string) <= Date.now()) {
								const guild = client.guilds.resolve(case_.guild_id);

								if (!guild) {
									continue;
								}

								try {
									const newCase = await deleteCase({ guild, user: client.user, caseId: case_.case_id });
									await upsertCaseLog(guild, client.user, newCase);
								} catch (error_) {
									const error = error_ as Error;
									logger.error(error, error.message);
								}
							}
						}

						break;
					}

					default:
						break;
				}
			},
			{ connection: redis as unknown as RedisClient },
		);
	} catch (error_) {
		const error = error_ as Error;
		logger.error(error, error.message);
	}
}
