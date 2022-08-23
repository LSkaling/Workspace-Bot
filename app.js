
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
      block[2].text.text = `*Description:* ${command.text}`
    
      //posts message to workspace core
      await app.client.chat.postMessage({
        channel: "workspace-core",
        link_names: true,
        text: "New Workspace Request",
        blocks: block,
      }) 
    } catch (e) {
    }
  });
});



//User selects "add task" from workspace request
app.action('add_task', async ({ body, ack, say }) => {
  await ack();

  metadata = JSON.stringify({
    "requesting_user": body.message.blocks[1].text.text,
    "approving_user": body.user.id,
    "message_ts": body.container.message_ts,
    "channel_id": body.container.channel_id,
    "description" : body.message.blocks[2].text.text
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


//submitting the "add task" modal
app.view('add_task_modal', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view_submission request
  await ack();

  metadata = JSON.parse(body.view.private_metadata)

  fs.readFile("request.json", 'utf8', async (err, data) => {
    if (err) throw err;
    try {        
      const block = JSON.parse(data); 
      block[1].text.text = metadata.requesting_user
      block[2].text.text = metadata.description   
      block[4] = {
        "type":"context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": `Added to tasks by <@${metadata.approving_user}>`
          }
        ]
      };
    
      //posts message to workspace core
      await app.client.chat.update({
        channel: metadata.channel_id,
        link_names: true,
        ts: metadata.message_ts,
        text: "New Workspace Request",
        blocks: block,
      }) 
    } catch (e) {
    }
  });

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