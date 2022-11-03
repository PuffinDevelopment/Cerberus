/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import typegoose from "@typegoose/typegoose";
import { now } from "mongoose";

const { modelOptions, getModelForClass, prop } = typegoose;

@modelOptions({ schemaOptions: { timestamps: true } })
export class cases {
	@prop({ required: true })
	guild_id!: string;

	@prop()
	message!: string;

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

	@prop()
	action_duration!: Date;

	@prop({ default: true })
	action_processed!: boolean;

	@prop({ default: now(), required: true })
	created_at!: Date;

	@prop()
	mute_message!: string;
}

export default getModelForClass(cases);
