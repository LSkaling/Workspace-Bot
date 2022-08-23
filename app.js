
var fs = require('fs');
const { App, AwsLambdaReceiver } = require('@slack/bolt');

// Initialize your custom receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and the AWS Lambda ready receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,

});

var block;

fs.readFile("text.json", 'utf8', async (err, data) => {
  if (err) throw err;
  try {        
    block   = JSON.parse(data); 

  // use block accordingly**
    
  } catch (e) {
    
  }
});

app.command('/workspace-request', async ({ command, ack, respond }) => {
  await ack();

  //posts message to user
  await app.client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    text: "Your request has been sent to workspace managers. Thanks!"
  })

  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "New Workspace Request:"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*User:* @${command.user_name}`
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Description:* ${command.text}`
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Add to tasks"
          },
          "action_id": "add_task"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Resolve"
          },
          "action_id": "resolve"
        }
      ]
    }
  ]
  block[2].text.text = "Testing!"

  //posts message to workspace core
  await app.client.chat.postMessage({
    channel: "workspace-core",
    link_names: true,
    blocks: block,
  })

});



//User selects "add task" from workspace request
app.action('add_task', async ({ body, ack, say }) => {
  await ack();

  metadata = JSON.stringify({
    "requesting_user": body.message.blocks[1].text.text,
    "approving_user": body.user,
    "message_ts": body.container.message_ts,
    "channel_id": body.container.channel_id
  })

  try {
    // Call views.open with the built-in client
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
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Description: '
            },
          },
          {
            type: 'input',
            block_id: 'input_d',
            label: {
              type: 'plain_text',
              text: 'Task Name'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'dreamy_input',
              multiline: false
            }
          },
          {
            type: 'input',
            block_id: 'input_c',
            label: {
              type: 'plain_text',
              text: 'Details'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'dreamy_input',
              multiline: true
            }
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Add as task'
        }
      }
    });
    //console.log(result);
  }
  catch (error) {
    console.log(error);
  }
});


//submitting the "add task" modal
app.view('add_task_modal', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view_submission request
  await ack();

  metadata = JSON.parse(body.view.private_metadata)

  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "New Workspace Request:"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*User:*`
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Description:*`
      }
    },
  ]
  //remove text buttons
  try{
    const result = await app.client.chat.update({
      channel: metadata.channel_id,
      ts: metadata.message_ts,
      blocks: blocks
    })
    console.log(result)
  }catch{
    console.log(error)
  }

  //add to spreadsheet
  
  

});

app.action('resolve', async ({ body, ack, say }) => {
  await ack();

  await say(`<@${body.user.id}> clicked the button`);
});


// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}