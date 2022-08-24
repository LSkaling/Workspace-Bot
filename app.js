
var fs = require('fs');
const { App, AwsLambdaReceiver } = require('@slack/bolt');
const { GoogleSpreadsheet } = require('google-spreadsheet')

const creds = require('./client_secret.json')
const doc = new GoogleSpreadsheet('1q1pYRZxo9rS-IyfcKZKzBRJSUtAgbmrR8gDL26YFqTQ/');




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
  try {
    await app.client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "Your request has been sent to workspace managers. Thanks!"
    })
  } catch (error) {
    await app.client.chat.postMessage({
      channel: command.user_id,
      text: "Your request has been sent to workspace managers. Thanks!"
    })
  }

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

app.action('resolve_modal_a', async ({ body, ack, say }) => { ack() })

app.action('resolve_modal_b', async ({ body, ack, say }) => { ack() })

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
    }, {
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
    },
    {
      "type": "divider"
    }
    ]


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

//Listing tasks
app.command('/workspace-tasks', async ({ command, ack, respond }) => {
  await ack();

  //fetch from spreadsheet

  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);

  const sheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]
  console.log(sheet.title);
  console.log(sheet.rowCount);

  const loadCellLocation = `A1:B${sheet.rowCount}`
  await sheet.loadCells(loadCellLocation);

  var text = ""//`ID \t Task Title`

  const maxCellsToDispaly = 20
  const cellsToDisplay = sheet.rowCount > maxCellsToDispaly ? maxCellsToDispaly : sheet.rowCount
  for (let i = 0; i < cellsToDisplay; i++) {
    text += `${sheet.getCell(i, 0).value} \t ${sheet.getCell(i, 1).value} \n`
  }

  await app.client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    text: text,

  })
});

//completing tasks
app.command('/workspace-complete', async ({ command, ack, respond }) => {
  await ack();

  const taskIDString = command.text

  if (taskIDString.length != 4 || parseInt(taskIDString) == NaN) { //invalid job id
    await respond("Invalid Job ID. Command should be in the following format: /workspace-complete XXXX")

  } else {
    const taskId = parseInt(taskIDString)
    //open spreadsheet and attempt to find job ID
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key,
    });

    const sheet = await loadSpreadsheet()

    var taskName
    var taskDescription

    for (let i = 0; i < sheet.rowCount; i++) {
      if (sheet.getCell(i, 0).value == taskId) {
        taskName = sheet.getCell(i, 1).value
        taskDescription = sheet.getCell(i, 2).value
      }
    }

    if (taskName == null) { //task was not found in sheet
      await respond(`Error: could not find task ID *"${taskId}"* in the tasks list. Please double check the ID and message @Workspace if the issue persists`)
    } else {
      

      fs.readFile("workspace_contribution.json", 'utf8', async (err, data) => {
        if (err) throw err;
        try {
          const view = JSON.parse(data);
          view.blocks[1].text.text = `*Task ID:* ${taskIDString}\n*Task name:* ${taskName}\n *Task Description:* ${taskDescription}`
          view.private_metadata = taskIDString
          console.log(JSON.stringify(view))
          //opens modal
          const result = await app.client.views.open({
            // Pass a valid trigger_id within 3 seconds of receiving it
            trigger_id: command.trigger_id,
            // View payload
            view: view
          });

        } catch (e) {
          console.log(e)
        }
      })
    }

  }


});

//submitting the complete task modal
app.view('submit_task', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view_submission request
  await ack();

  //metadata = JSON.parse(body.view.private_metadata)
  console.log(`submit body: ${JSON.stringify(body.view.private_metadata)}`)

  const taskID = body.view.private_metadata
  const userID = body.user.id
  const userinfo = await app.client.users.info({
    user: userID
  })
  const useremail = userinfo.user.profile.email

  console.log(`\ntask ID: ${taskID}, userID: ${userID}, useremail: ${useremail}`)

  //update cleaning duties page to reflect completed task


  //update requirements page to update user contirbutions

});

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}

async function loadSpreadsheet() {
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]
  const cellRange = `A1:H${sheet.rowCount}`
  await sheet.loadCells(cellRange)
  return sheet
}

