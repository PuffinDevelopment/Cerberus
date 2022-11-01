import process from "node:process";
import { container } from "@yuudachi/framework";
import Redis from "ioredis";
import { kRedis } from "../tokens.js";

export async function createRedis() {
	// @ts-expect-error: This is callable
	const redis = new Redis(process.env.REDISHOST!);
	container.register(kRedis, { useValue: redis });
}
