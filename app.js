
var fs = require('fs');
const { App, AwsLambdaReceiver } = require('@slack/bolt');
const { GoogleSpreadsheet } = require('google-spreadsheet')
const { promisify } = require('util')
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const creds = require('./client_secret.json')
const doc = new GoogleSpreadsheet('1q1pYRZxo9rS-IyfcKZKzBRJSUtAgbmrR8gDL26YFqTQ/');

const auth = new GoogleAuth(
  { scopes: 'https://www.googleapis.com/auth/spreadsheet' });

const service = google.sheets({ version: 'v4', auth }); //added from google dev

async function accessSpreadsheet() {
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);

  const sheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]
  console.log(sheet.title);
  console.log(sheet.rowCount);

}

// Initialize your custom receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and the AWS Lambda ready receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,

});



app.command('/workspace-request', async ({ command, ack, respond }) => {
  await ack();

  //posts message to user
  await app.client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    text: "Your request has been sent to workspace managers. Thanks!"
  })

  fs.readFile("request.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const block = JSON.parse(data);
      block[1].text.text = `*User:* @${command.user_name}`
      block[2].text.text = `*Request description:* ${command.text}`

      //posts message to workspace core
      await app.client.chat.postMessage({
        channel: "workspace-core",
        link_names: true,
        text: "New Workspace Request",
        blocks: block,
        metadata: {
          event_type: "test",
          event_payload: {
            "requester_username": command.user_name,
            "requester_id": command.user_id
          }
        }
      })
    } catch (e) {
    }
  });
});



//User selects "add task" from workspace request
app.action('add_task', async ({ body, ack, say }) => {
  await ack();

  //console.log(`body: ${JSON.stringify(body)}`)
  const receivingMetadata = body.message.metadata.event_payload
  const requester_username = receivingMetadata.requester_username
  const requester_id = receivingMetadata.requester_id


  metadata = JSON.stringify({
    "requester_username": requester_username,
    "requester_id": requester_id,
    "approver_username": body.user.username,
    "approver_id": body.user.id,
    "message_ts": body.container.message_ts,
    "message_user_text": body.message.blocks[1].text.text,
    "message_description": body.message.blocks[2].text.text,
    "channel_id": body.container.channel_id,
    "description": body.message.blocks[2].text.text,
  })

  fs.readFile("add_task_modal.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const block = JSON.parse(data);
      const result = await app.client.views.open({
        // Pass a valid trigger_id within 3 seconds of receiving it
        trigger_id: body.trigger_id,
        // View payload
        view: {
          type: 'modal',
          // View identifier
          callback_id: 'add_task_modal',
          title: {
            type: 'plain_text',
            text: 'Add Task'
          },
          private_metadata: metadata,
          blocks: block,
          submit: {
            type: 'plain_text',
            text: 'Add as task'
          }
        }
      });
      //console.log(result);
    } catch (e) {
      console.log(result)
    }
  });
});

//User selects "resolve" from workspace request
app.action('resolve', async ({ body, ack, say }) => {
  await ack();

  const receivingMetadata = body.message.metadata.event_payload
  const requester_username = receivingMetadata.requester_username
  const requester_id = receivingMetadata.requester_id


  metadata = JSON.stringify({
    "requester_username": requester_username,
    "requester_id": requester_id,
    "approver_username": body.user.username,
    "approver_id": body.user.id,
    "message_ts": body.container.message_ts,
    "message_user_text": body.message.blocks[1].text.text,
    "message_description": body.message.blocks[2].text.text,
    "channel_id": body.container.channel_id,
    "description": body.message.blocks[2].text.text,
  })

  fs.readFile("resolve_modal.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const block = JSON.parse(data);
      const result = await app.client.views.open({
        // Pass a valid trigger_id within 3 seconds of receiving it
        trigger_id: body.trigger_id,
        // View payload
        view: {
          type: 'modal',
          // View identifier
          callback_id: 'resolve_modal',
          title: {
            type: 'plain_text',
            text: 'Resolve Task'
          },
          private_metadata: metadata,
          blocks: block,
          submit: {
            type: 'plain_text',
            text: 'Resolve'
          }
        }
      });
      //console.log(result);
    } catch (e) {
      //console.log(result)
    }
  });
});

app.action('resolve_modal_a', async ({ body, ack, say }) => {
  ack()
  console.log("action found")
})

app.action('resolve_modal_b', async ({ body, ack, say }) => {
  ack()
  console.log("action found")
})

//submitting the "add task" modal
app.view('add_task_modal', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view_submission request
  await ack();

  metadata = JSON.parse(body.view.private_metadata)

  const nameField = body.view.state.values.input_d.dreamy_input.value
  const detailsField = body.view.state.values.input_c.dreamy_input.value
  const requesterName = metadata.requesterName

  fs.readFile("request.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const block = JSON.parse(data);
      block[1].text.text = metadata.message_user_text
      block[2].text.text = metadata.message_description
      block[4] = {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": `Added to tasks by <@${metadata.approver_id}>`
          }
        ]
      };

      //posts message to workspace core - add this back in to remove buttons
      // await app.client.chat.update({
      //   channel: metadata.channel_id,
      //   link_names: true,
      //   ts: metadata.message_ts,
      //   text: "New Workspace Request",
      //   blocks: block,
      // })



    } catch (e) {
    }
  });


  //add to spreadsheet

  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);

  const sheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]
  console.log(sheet.title);
  console.log(sheet.rowCount);

  const cellRange = `A1:H${sheet.rowCount}`

  await sheet.loadCells(cellRange)

  sheet.addRow([sheet.rowCount, nameField, detailsField, "1", "1", metadata.requester_username, metadata.approver_username])

  //notify requester
  const text = `Your request has been added to the todo list by <@${metadata.approver_id}>`

  await app.client.chat.postMessage({
    channel: metadata.requester_id,
    text: text,
    blocks: [{
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": text
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": metadata.message_description
      }
    },    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Task ID:* ${sheet.rowCount}`
      }
    },    
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Task title:* ${nameField}`
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Task description:* ${detailsField}`
      }
    }]


  })
});

//submitting the "resolve" modal
app.view('resolve_modal', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view_submission request
  await ack();

  console.log("modal submitted")

  metadata = JSON.parse(body.view.private_metadata)

  const dropdown = body.view.state.values.dropdown.resolve_modal_a.selected_option.value
  const notifyUser = body.view.state.values.button.resolve_modal_a.selected_options != ""

  console.log(`dropdown:  ${dropdown}`)
  console.log(`button: ${notifyUser}`)


  fs.readFile("request.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const block = JSON.parse(data);
      block[1].text.text = metadata.message_user_text
      block[2].text.text = metadata.message_description
      block[4] = {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": `Marked as ${dropdown} by <@${metadata.approver_id}>`
          }
        ]
      };
      // await app.client.chat.update({
      //   channel: metadata.channel_id,
      //   link_names: true,
      //   ts: metadata.message_ts,
      //   text: "New Workspace Request",
      //   blocks: block,
      // })

    } catch (e) {
      console.log(e)
    }

    //notifying requester
    if (notifyUser) {

      var text = "error"

      if (dropdown == "complete") {
        text = `Your request has been marked complete by <@${metadata.approver_id}>`
      } else if (dropdown == "added_to_order") {
        text = `Your request has been added to be ordered by <@${metadata.approver_id}>`
      } else if (dropdown == "ordered") {
        text = `Your request has been ordered by <@${metadata.approver_id}>`
      } else if (dropdown == "notified_facilities") {
        text = `<@${metadata.approver_id}> has notified facilities of your request`
      } else if (dropdown == "dismissed") {
        text = `Your request has been dismissed by <@${metadata.approver_id}>`
      }

      await app.client.chat.postMessage({
        channel: metadata.requester_id,
        text: text,
        blocks: [{
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": text
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": metadata.message_description
          }
        }]


      })
    }
  });




});



// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}