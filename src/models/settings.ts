/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import typegoose from "@typegoose/typegoose";

const { getModelForClass, prop } = typegoose;

export class settings {
	@prop({ required: true })
	guild_id!: string;

	@prop({ required: true })
	guild_log_channel_id!: string;

	@prop({ required: true })
	mod_log_channel_id!: string;

	@prop({ required: true })
	mod_role_id!: string;

	@prop({ required: true })
	report_channel_id!: string;

	@prop({ required: true })
	report_status_tags!: string[];

	@prop({ required: true })
	report_type_tags!: string[];
}

export default getModelForClass(settings);
