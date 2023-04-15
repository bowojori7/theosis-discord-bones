import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import {
  VerifyDiscordRequest,
  getRandomEmoji,
  DiscordRequest,
} from "./utils.js";
import { getShuffledOptions, getShuffledPowers, getResult } from "./game.js";

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};
const readyAcolytes = [];

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post("/interactions", async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === "fight" && id) {
      const userName = req.body.member.user.username;
      const userId = req.body.member.user.id;
      // Send a message into the channel where command was triggered from
      if (readyAcolytes.some((readyAcolyte) => readyAcolyte.id === userId)) {
        const foundAcolyte = readyAcolytes.find(
          (readyAcolyte) => readyAcolyte.id === userId
        );
        // Create active game using message ID as the game ID
        activeGames[id] = {
          player1: foundAcolyte,
        };
        console.log(activeGames[id]);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: `<${userName}> asks if anybody dares to face them in the arena`,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.BUTTON,
                    // Append the game ID to use later on
                    custom_id: `accept_button_${req.body.id}`,
                    label: "Accept Challenge",
                    style: ButtonStyleTypes.PRIMARY,
                  },
                ],
              },
            ],
          },
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: `You do not have the blood of theos flowing through you yet unnamed one.\n Go to the genesis before you try step into the arena.`,
          },
        });
      }
    }
    if (name === "genesis" && id) {
      const userName = req.body.member.user.username;
      const userId = req.body.member.user.id;
      // Send a message into the channel where command was triggered from

      // User's object choice

      // Create active game using message ID as the game ID
      if (readyAcolytes.some((readyAcolyte) => readyAcolyte.id === userId)) {
        const foundAcolyte = readyAcolytes.find(
          (readyAcolyte) => readyAcolyte.id === userId
        );
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: `Greetings ${userName},
            \nIt seems you've been past here before, the acolyte with the ${foundAcolyte.power}, yes ?
            \nGo into the Arena and battle for glory.`,
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: `Greetings Acolyte, we'll call you ${userName}.
    \n${userName}, The Ecclesia has allowed you to pick your starting power - choose wisely.
    \nBut first, do you dare to enter the Theoverse ?`,
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.BUTTON,
                    // Append the game ID to use later on
                    custom_id: `enter_button_${req.body.id}`,
                    label: "Enter",
                    style: ButtonStyleTypes.PRIMARY,
                  },
                ],
              },
            ],
          },
        });
      }
    }
  }
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;
    if (componentId.startsWith("enter_button_")) {
      const gameId = componentId.replace("enter_button_", "");
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: "What is your power of choice?",
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Append game ID
                    custom_id: `select_choice_${gameId}`,
                    options: getShuffledPowers(),
                  },
                ],
              },
            ],
          },
        });
        await DiscordRequest(endpoint, { method: "DELETE" });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    }
  }
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const userId = req.body.member.user.id;
    const userName = req.body.member.user.username;
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;
    activeGames[id] = {
      id: userId,
    };
    if (componentId.startsWith("select_choice_")) {
      const selectedPower = data.values[0];
      let newAcolyte = {
        id: userId,
        name: userName,
        hp: 1,
        pp: 1,
        power: selectedPower,
      };
      readyAcolytes.push(newAcolyte);
      const gameId = componentId.replace("select_choice_", "");
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: `Good choice Acolyte ${userName}, you selected ${selectedPower}.\nYour starting HP is 1 and PP is 1 as you begin your journey.\nWelcome to Theosis.`,
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
        await DiscordRequest(endpoint, { method: "DELETE" });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
