import process from "node:process";
import { container } from "@yuudachi/framework";
import mongoose from "mongoose";
import { kMongo } from "../tokens.js";

export async function createMongo() {
	const mongo = await mongoose.connect(process.env.MONGO_URI!);
	container.register(kMongo, { useValue: mongo });
}
