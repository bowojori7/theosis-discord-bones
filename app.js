import "dotenv/config";
import express from "express";
import axios from "axios";
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
            content: `Good choice Acolyte ${userName}, you selected ${selectedPower}.\nYour starting HP is 1 and Power Level is 1 as you begin your journey.\nWelcome to Theosis.`,
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

  //////HANDLE FIGHT ACCEPTANCE-------------------------

  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;
    const gameId = componentId.replace("accept_button_", "");
    const userId = req.body.member.user.id;
    if (componentId.startsWith("accept_button_")) {
      // get the associated game ID

      // Delete message with token in request body
      if (readyAcolytes.some((readyAcolyte) => readyAcolyte.id === userId)) {
        const foundAcolyte = readyAcolytes.find(
          (readyAcolyte) => readyAcolyte.id === userId
        );

        activeGames[gameId]["player2"] = foundAcolyte;

        let gameDetails = {
          Acolytes: [
            {
              Name: activeGames[gameId]["player1"].name,
              Powers: [
                {
                  Name: activeGames[gameId]["player1"].power,
                  PowerLevel: 1,
                },
              ],
              HP: 100,
              Actions: [
                {
                  Round: 1,
                  Action: "I do stuff with my powers",
                },
              ],
            },
            {
              Name: activeGames[gameId]["player2"].name,
              Powers: [
                {
                  Name: activeGames[gameId]["player2"].power,
                  PowerLevel: 1,
                },
              ],
              HP: 100,
              Actions: [
                {
                  Round: 1,
                  Action: "I do stuff with my power",
                },
              ],
            },
          ],
          Environment: "clear day, moderate temparature, no wind, dry terrain",
          CurrentRound: 1,
        };
        const getIntro = async (gamedetails) => {
          let res = await axios.post(
            "https://aetherarbiter.bowojori7.repl.co/intro",
            gamedetails
          );
          console.log(res.data);
          let body = {
            content: res.data,

            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    label: "Start battle",
                    style: 1,
                    custom_id: `start_battle_${gameId}`,
                  },
                ],
              },
            ],
          };
          const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}`;
          await DiscordRequest(endpoint, {
            method: "POST",
            body,
          });

          return res.data;
        };

        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        getIntro(gameDetails);
        try {
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `The stage is set, the battle will be between ${activeGames[gameId]["player1"].name} and ${activeGames[gameId]["player2"].name}.\nThe arbiter will take the stage now.`,
            },
          });
          // Delete previous message
          await DiscordRequest(endpoint, { method: "DELETE" });
        } catch (err) {
          console.error("Error sending message:", err);
        }
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You are not yet worthy to accept challenges.\n Go to the genesis before you try step into the arena.`,
          },
        });
      }
    }
  }

  /////////////START BATTLE CLICK

  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith("start_battle_")) {
      // get the associated game ID
      const gameId = componentId.replace("start_battle_", "");
      const userId = req.body.member.user.id;
      const userName = req.body.member.user.username;
      if (readyAcolytes.some((readyAcolyte) => readyAcolyte.id === userId)) {
        res.send({
          type: InteractionResponseType.MODAL,
          data: {
            title: `${activeGames[gameId]["player1"].name}, time to make your move!`,
            custom_id: `p1_action_input_${gameId}`,
            flags: InteractionResponseFlags.EPHEMERAL,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: "player_one_move",
                    label: "Action",
                    style: 1,
                    min_length: 1,
                    max_length: 4000,
                    placeholder: "Super move!",
                    required: true,
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
            content: `Who are you ?`,
          },
        });
      }
    }
  }
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith("continue_battle_")) {
      // get the associated game ID
      const gameId = componentId.replace("continue_battle_", "");
      const userId = req.body.member.user.id;
      const userName = req.body.member.user.username;
      if (readyAcolytes.some((readyAcolyte) => readyAcolyte.id === userId)) {
        res.send({
          type: InteractionResponseType.MODAL,
          data: {
            title: `${activeGames[gameId]["player2"].name}, time to make your move!`,
            custom_id: `p2_action_input_${gameId}`,
            flags: InteractionResponseFlags.EPHEMERAL,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: "player_two_move",
                    label: "Action",
                    style: 1,
                    min_length: 1,
                    max_length: 4000,
                    placeholder: "Super move!",
                    required: true,
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
            content: `Who are you ?`,
          },
        });
      }
    }
  }

  /////////////////CONCLUDE BATTLE
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith("conclude_battle_")) {
      // get the associated game ID
      const gameId = componentId.replace("conclude_battle_", "");
      const userId = req.body.member.user.id;
      const userName = req.body.member.user.username;

      let gameDetails = {
        Acolytes: [
          {
            Name: activeGames[gameId]["player1"].name,
            Powers: [
              {
                Name: activeGames[gameId]["player1"].power,
                PowerLevel: 1,
              },
            ],
            HP: 100,
            Actions: [
              {
                Round: 1,
                Action: activeGames[gameId]["player1move"],
              },
            ],
          },
          {
            Name: activeGames[gameId]["player2"].name,
            Powers: [
              {
                Name: activeGames[gameId]["player2"].power,
                PowerLevel: 1,
              },
            ],
            HP: 100,
            Actions: [
              {
                Round: 1,
                Action: activeGames[gameId]["player2move"],
              },
            ],
          },
        ],
        Environment: "clear day, moderate temparature, no wind, dry terrain",
        CurrentRound: 1,
      };
      const getFinale = async (gamedetails) => {
        let res = await axios.post(
          "https://aetherarbiter.bowojori7.repl.co/finale",
          gamedetails
        );
        console.log(res.data);
        let body = {
          content: res.data,
        };
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}`;
        await DiscordRequest(endpoint, {
          method: "POST",
          body,
        });

        return res.data;
      };

      if (readyAcolytes.some((readyAcolyte) => readyAcolyte.id === userId)) {
        getFinale(gameDetails);
        res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "...",
          },
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Who are you ?`,
          },
        });
      }
    }
  }

  ///////HANDLE MODAL INTERACTIONS
  if (type === InteractionType.MODAL_SUBMIT) {
    const componentId = data.custom_id;

    if (componentId.startsWith("p1_action_input_")) {
      const gameId = componentId.replace("p1_action_input_", "");
      activeGames[gameId]["player1move"] =
        data.components[0].components[0].value;

      const userId = req.body.member.user.id;
      const gamesArr = Object.values(activeGames[gameId]);
      if (gamesArr.some((player) => player.id === userId)) {
        res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `${activeGames[gameId]["player1"].name} has made their move, are you ready ${activeGames[gameId]["player2"].name}?`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    label: "I do not know fear!",
                    style: 1,
                    custom_id: `continue_battle_${gameId}`,
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
            content: `You shouldn't be here.`,
          },
        });
      }
    } else if (componentId.startsWith("p2_action_input_")) {
      const gameId = componentId.replace("p2_action_input_", "");
      activeGames[gameId]["player2move"] =
        data.components[0].components[0].value;

      const userId = req.body.member.user.id;
      const gamesArr = Object.values(activeGames[gameId]);
      if (gamesArr.some((player) => player.id === userId)) {
        res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Both players have mae their move, the arbiter ponders.`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    label: "Look to the arbiter",
                    style: 1,
                    custom_id: `conclude_battle_${gameId}`,
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
            content: `You shouldn't be here.`,
          },
        });
      }
    }
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
