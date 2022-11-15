import { createButton } from "@yuudachi/framework";
import { type Message, ButtonStyle } from "discord.js";

export function createMessageLinkButton(message: Message<true>) {
	return createButton({
		style: ButtonStyle.Link,
		url: message.url,
		label: "Original message",
	});
}
