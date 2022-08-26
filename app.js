
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
  ack();

  try {
    fs.readFile("request.json", 'utf8', async (err, data) => {
      if (err) throw err;
      const messagePayload = JSON.parse(data);
      messagePayload.blocks[1].text.text = `*User:* @${command.user_name}`
      messagePayload.blocks[2].text.text = `*Request description:* ${command.text}`
      messagePayload.metadata.event_payload.requester_username = command.user_name
      messagePayload.metadata.event_payload.requester_id = command.user_id

      //posts message to workspace core
      await app.client.chat.postMessage(messagePayload)
      await respond("Your request has been sent to workspace managers. Thanks!")
    });
  } catch (error) {
    reportError(error, "workspace request command")
  }
});

//User selects "add task" from workspace request
app.action('add_task', async ({ body, ack, say }) => {
  await ack();

  const receivingMetadata = body.message.metadata.event_payload
  const requester_username = receivingMetadata.requester_username
  const requester_id = receivingMetadata.requester_id


  metadata = JSON.stringify({
    "requester_username": requester_username,
    "requester_id": requester_id,
    "approver_username": body.user.name,
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
      const modal = JSON.parse(data);
      modal.trigger_id = body.trigger_id
      modal.view.private_metadata = metadata
      await app.client.views.open(modal);
    } catch (e) {
      console.log(e)
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
      const modal = JSON.parse(data);
      modal.trigger_id = body.trigger_id
      modal.view.private_metadata = metadata
      await app.client.views.open(modal);
    } catch (e) {
      console.log(error)
    }
  });
});

app.action('resolve_modal_a', async ({ body, ack, say }) => { ack() })

app.action('resolve_modal_b', async ({ body, ack, say }) => { ack() })

//submitting the "add task" modal
app.view('add_task_modal', async ({ ack, body, view, client, logger }) => {
  await ack();

  metadata = JSON.parse(body.view.private_metadata)

  const nameField = body.view.state.values.input_d.dreamy_input.value
  const detailsField = body.view.state.values.input_c.dreamy_input.value

  fs.readFile("request.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const modal = JSON.parse(data);
      modal.blocks[1].text.text = metadata.message_user_text
      modal.blocks[2].text.text = metadata.message_description
      modal.blocks[4] = {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": `Added to tasks by <@${metadata.approver_id}>`
          }
        ]
      };
      modal.ts = metadata.message_ts
      modal.channel = metadata.channel_id

      //posts message to workspace core - add this back in to remove buttons
      await app.client.chat.update(modal)
    } catch (e) {
      console.log(e)
    }
  });


  //add to spreadsheet

  const taskSheet = await loadTasksSheet()

  var jobID = convertToJobID(`${taskSheet.rowCount}`)
 
  const requester = await client.users.info({ user: metadata.requester_id })
  const requesterName = requester.user.real_name

  const approver = await client.users.info({ user: metadata.approver_id })
  const approverName = approver.user.real_name

  await taskSheet.addRow([jobID, nameField, detailsField, "1", "1", requesterName, approverName])

  //notify requester
  const text = `Your request has been added to the todo list by <@${metadata.approver_id}>`

  fs.readFile("task_added_notification.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const modal = JSON.parse(data);
      modal.channel = metadata.requester_id
      modal.text = text
      modal.blocks[0].text.text = text
      modal.blocks[1].text.text = metadata.message_description
      modal.blocks[2].text.text = `*Task ID:* ${taskSheet.rowCount}`
      modal.blocks[3].text.text = `*Task title:* ${nameField}`
      modal.blocks[4].text.text = `*Task description:* ${detailsField}`

      //posts message to workspace core - add this back in to remove buttons
      await app.client.chat.postMessage(modal)

    } catch (e) {
      console.log(e)
    }
  });
});

//submitting the "resolve" modal
app.view('resolve_modal', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view_submission request
  await ack();

  console.log("modal submitted")

  metadata = JSON.parse(body.view.private_metadata)

  console.log(`dropdown options: ${JSON.stringify(body.view.state.values.dropdown.resolve_modal_a)}`)

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
            "text": `Marked as "${body.view.state.values.dropdown.resolve_modal_a.selected_option.text.text}" by <@${metadata.approver_id}>`
          }
        ]
      };
      await app.client.chat.update({
        channel: metadata.channel_id,
        link_names: true,
        ts: metadata.message_ts,
        text: "New Workspace Request",
        blocks: block,
      })

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

  const sheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]

  const loadCellLocation = `A1:E${sheet.rowCount}`
  await sheet.loadCells(loadCellLocation);

  var text = ""//`ID \t Task Title`

  //gets first 20 jobs
  var iterationsCount = 0
  var itemsCount = 0
  while (itemsCount < 20 && iterationsCount < sheet.rowCount) {

    if (sheet.getCell(iterationsCount, 4).value != "0") {
      text += `${sheet.getCell(iterationsCount, 0).value} \t ${sheet.getCell(iterationsCount, 1).value} \n`
      itemsCount++
    }
    iterationsCount++

  }
  //text += "click here for more info"
  if (itemsCount == 20) {
    text += `Showing first 20 results. <https://docs.google.com/spreadsheets/d/1q1pYRZxo9rS-IyfcKZKzBRJSUtAgbmrR8gDL26YFqTQ/edit#gid=1753132064|Click here> for more details and the full list.`
  } else {
    text += `<https://docs.google.com/spreadsheets/d/1q1pYRZxo9rS-IyfcKZKzBRJSUtAgbmrR8gDL26YFqTQ/edit#gid=1753132064|Click here> for more details.`
  }

  await respond(text)
  // await app.client.chat.postEphemeral({
  //   channel: command.channel_id,
  //   user: command.user_id,
  //   text: text,

  // })
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

    const sheet = await loadTasksSheet()

    var taskName
    var taskDescription

    //todo: this can be replaced now that we assume the sheet is ordered
    for (let i = 0; i < sheet.rowCount; i++) {
      if (sheet.getCell(i, 0).value == taskId) {
        taskName = sheet.getCell(i, 1).value
        taskDescription = sheet.getCell(i, 2).value
      }
    }

    const slotsAvailable = sheet.getCell(taskId, 4).value

    console.log(`slots available: ${slotsAvailable}`)

    if (taskName == null) { //task was not found in sheet
      await respond(`Error: could not find task ID *"${taskId}"* in the tasks list. Please double check the ID and message @Workspace if the issue persists`)
    } else if (slotsAvailable < 1) {
      await respond(`This job is no longer offered. Double check the job ID, and if you already completed it, please message @workspace.`)
    } else {
      fs.readFile("workspace_contribution.json", 'utf8', async (err, data) => {
        if (err) throw err;
        try {
          const view = JSON.parse(data);
          view.blocks[1].text.text = `*Task ID:* ${taskIDString}\n*Task name:* ${taskName}\n *Task Description:* ${taskDescription}`
          view.private_metadata = taskIDString
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
  const taskID = body.view.private_metadata
  const userID = body.user.id

  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo();

  let [userinfo, taskSheet, requirementsSheet] = await Promise.all([app.client.users.info({
    user: userID
  }), loadTasksSheet(), loadRequirementsSheet()])


  // const userinfo = await app.client.users.info({
  //   user: userID
  // })
  const useremail = userinfo.user.profile.email
  const username = userinfo.user.real_name

  console.log(`username: ${username}`)

  //const taskSheet = await loadTasksSheet() //getcell: (down, across)
  const taskIDValue = parseInt(taskID)
  taskSheet.getCell(taskIDValue, 4).value -= 1

  console.log(taskSheet.getCell(taskIDValue, 7).value)

  if (taskSheet.getCell(taskIDValue, 7).value == null) {
    console.log("empty")
    await taskSheet.saveUpdatedCells()
    taskSheet.getCell(taskIDValue, 7).value = `${username}`
  } else {
    console.log("not empty")
    await taskSheet.saveUpdatedCells()
    taskSheet.getCell(taskIDValue, 7).value += `, ${username}`
  }



  await taskSheet.saveUpdatedCells()

  var completedTasks
  var requiredTasks
  //await taskSheet.saveUpdatedCells()

  //update requirements page to update user contirbutions
  //const requirementsSheet = await loadRequirementsSheet()
  for (let i = 0; i < requirementsSheet.rowCount; i++) {
    console.log(`useremail: ${useremail} : ${requirementsSheet.getCell(i, 1).value}`)
    if (requirementsSheet.getCell(i, 1).value == useremail) {
      requirementsSheet.getCell(i, 3).value += 1
      await requirementsSheet.saveUpdatedCells()
      completedTasks = requirementsSheet.getCell(i, 3).value
      requiredTasks = requirementsSheet.getCell(i, 2).value
    }
  }

  //DM user to thank them
  await app.client.chat.postMessage({
    channel: userID,
    text: `Thank you for helping keep our workspace organized! You've now completed ${completedTasks} of the required ${requiredTasks} tasks.`,
  })

  //check if fewer than 10 tasks remain and message workspace-core if so

  const apiSheet = await loadAPISheet()
  var remainingWorkspaceTasks = apiSheet.getCellByA1("A2").value

  if (remainingWorkspaceTasks < 10) {
    await app.client.chat.postMessage({
      channel: "workspace-core",
      text: `Warning: only ${remainingWorkspaceTasks} open tasks remain on the cleaning duties sheet.`,
    })
  }




});

//Workspace help
app.command('/workspace-info', async ({ command, ack, respond }) => {
  await ack();

  //console.log(`Command: ${JSON.stringify(command)}`)

  const userID = command.user_id
  const userinfo = await app.client.users.info({
    user: userID
  })
  const useremail = userinfo.user.profile.email


  //fetch from spreadsheet

  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo(); // loads document properties and worksheets

  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id]

  const loadCellLocation = `A1:E${sheet.rowCount}`
  await sheet.loadCells(loadCellLocation);

  var tasksRequired
  var tasksCompleted

  for (let i = 0; i < sheet.rowCount; i++) {
    console.log(`useremail: ${useremail} : ${sheet.getCell(i, 1).value}`)
    if (sheet.getCell(i, 1).value == useremail) {
      tasksRequired = sheet.getCell(i, 2).value
      tasksCompleted = sheet.getCell(i, 3).value
    }
  }

  fs.readFile("workspace_info.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {
      const blocks = JSON.parse(data);
      blocks[1].text.text = `This quarter: ${tasksRequired} tasks required, ${tasksCompleted} tasks completed`

      await respond({ "blocks": blocks })
      //posts message to workspace core
    } catch (e) {
      console.log(e)
    }
  });
});

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}

async function loadTasksSheet() {
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]
  const cellRange = `A1:H${sheet.rowCount}`
  await sheet.loadCells(cellRange)
  return sheet
}

async function loadRequirementsSheet() {
  // await doc.useServiceAccountAuth({
  //   client_email: creds.client_email,
  //   private_key: creds.private_key,
  // });
  //await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id]
  const cellRange = `A1:E${sheet.rowCount}`
  await sheet.loadCells(cellRange)
  return sheet
}

async function loadAPISheet() {
  const sheet = doc.sheetsByIndex[2]; // or use doc.sheetsById[id]
  const cellRange = `A1:A2`
  await sheet.loadCells(cellRange)
  return sheet
}

async function reportError(error, location){
  await app.client.chat.postMessage({
    "channel": "workspace-core",
    "text": `Error found in ${location}: ${error}`,
  })
}

function convertToJobID(jobID){
  while (jobID.length < 4) {
    jobID = `0${jobID}`
  }
  jobID = `="${jobID}"`
  return jobID
}

