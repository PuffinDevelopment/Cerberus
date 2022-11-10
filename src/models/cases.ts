/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import typegoose, { type ReturnModelType } from "@typegoose/typegoose";
import { now } from "mongoose";

const { modelOptions, getModelForClass, prop } = typegoose;

@modelOptions({ schemaOptions: { timestamps: true } })
export class cases {
	@prop({ required: true })
	guild_id!: string;

	@prop({ required: true })
	case_id!: number;

	@prop()
	ref_id!: number;

	@prop({ required: true })
	target_id!: string;

	@prop({ required: true })
	target_tag!: string;

	@prop()
	mod_id!: string;

	@prop()
	mod_tag!: string;

	@prop({ required: true })
	action!: number;

	@prop()
	reason!: string;

	@prop({ default: null })
	context_message_id!: string;

	@prop({ default: null })
	action_expiration!: Date;

	@prop({ default: true })
	action_processed!: boolean;

	@prop({ default: now(), required: true })
	created_at!: Date;

	@prop({ default: false })
	multi!: boolean;

	public static async nextCase(this: ReturnModelType<typeof cases>, guild_id: string) {
		let id: number;
		const next_id = await this.find({ guild_id }).exec();
		if (!next_id) {
			id = 1;
		}

		id = next_id.length + 1;
		return id;
	}
}

export default getModelForClass(cases);
