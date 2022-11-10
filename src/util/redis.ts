import process from "node:process";
import { container } from "@yuudachi/framework";
import Redis from "ioredis";
import { kRedis } from "../tokens.js";

export async function createRedis() {
	const redis = new Redis.default(process.env.REDISHOST!, { maxRetriesPerRequest: null });
	container.register(kRedis, { useValue: redis });
}
