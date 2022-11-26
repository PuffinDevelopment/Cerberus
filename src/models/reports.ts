/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import typegoose, { type ReturnModelType } from "@typegoose/typegoose";
import { now } from "mongoose";

const { modelOptions, getModelForClass, prop } = typegoose;

@modelOptions({ schemaOptions: { timestamps: true } })
export class reports {
	@prop({ required: true })
	guild_id!: string;

	@prop({ required: true })
	report_id!: number;

	@prop({ required: true })
	type!: number;

	@prop({ required: true })
	status!: number;

	@prop()
	ref_id!: number;

	@prop({ required: true })
	author_id!: string;

	@prop({ required: true })
	author_tag!: string;

	@prop({ required: true })
	target_id!: string;

	@prop({ required: true })
	target_tag!: string;

	@prop()
	mod_id!: string;

	@prop()
	mod_tag!: string;

	@prop()
	reason!: string;

	@prop()
	attachment_url!: string;

	@prop()
	message_id!: string;

	@prop()
	channel_id!: string;

	@prop({ default: null })
	log_post_id!: string;

	@prop({ default: now(), required: true })
	created_at!: Date;

	public static async nextReport(this: ReturnModelType<typeof reports>, guild_id: string) {
		let id: number;
		const next_id = await this.find({ guild_id }).exec();
		if (!next_id) {
			id = 1;
		}

		id = next_id.length + 1;
		return id;
	}
}

export default getModelForClass(reports);
