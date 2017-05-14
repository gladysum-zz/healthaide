'use strict';
const fs = require('fs');
const parse = require('csv-parse/lib/sync');
require('should');

const ConversationV1 = require('watson-developer-cloud/conversation/v1');

class MyBot {

    /**
     * Creates a new instance of MyBot.
     * @param {string} conversationUsername - The Watson Conversation username
     * @param {string} conversationPassword - The Watson Converation password
     * @param {string} conversationWorkspaceId - The Watson Conversation workspace ID
     */
    constructor(conversationUsername, conversationPassword, conversationWorkspaceId) {
        this.conversationService = new ConversationV1({
            username: conversationUsername,
            password: conversationPassword,
            version_date: '2017-04-21'
        });
        this.conversationWorkspaceId = conversationWorkspaceId;
        this.conversationContext = null;
    }

    /**
     * Process the message entered by the user.
     * @param {string} message - The message entered by the user
     * @returns {Promise.<string|Error>} - The reply to be sent to the user if fulfilled, or an error if rejected
     */
    processMessage(message) {
        // The first step is to send the message entered by the user to Watson Conversation.
        // We send the conversationContext associated with the current user.
        // In this application there is only a single user, so we use the global conversationContext variable.
        // In a typical application you would associate the context with a user, and whenever
        // a new message is received you would look up that user and their context based on the User ID
        // from the messaging platform (for example, the Slack ID).
        let conversationResponse = null;
        return this.sendRequestToWatsonConversation(message, this.conversationContext)
            .then((response) => {
                conversationResponse = response;
                return this.handleResponseFromWatsonConversation(conversationResponse);
            })
            .then((reply) => {
                // Update our local conversationContext every time we receive a response from Watson Conversation.
                // This keeps track of the active dialog in the conversation.
                this.conversationContext = conversationResponse.context;
                // Return the reply to be sent to the user.
                return Promise.resolve(reply);
            })
            .catch((error) => {
                console.log(`Error: ${JSON.stringify(error,null,2)}`);
                let reply = 'Sorry, something went wrong!\n'
                return Promise.resolve(reply);
            });
    }

    /**
     * Sends the message entered by the user to Watson Conversation
     * along with the active Watson Conversation context that is used to keep track of the conversation.
     * @param {string} message - The message entered by the user
     * @param {object} conversationContext - The active Watson Conversation context
     * @returns {Promise.<object|error>} - The response from Watson Conversation if fulfilled, or an error if rejected
     */
    sendRequestToWatsonConversation(message, conversationContext) {
        return new Promise((resolve, reject) => {
            var conversationRequest = {
                input: {text: message},
                context: conversationContext,
                workspace_id: this.conversationWorkspaceId,
            };
            this.conversationService.message(conversationRequest, (error, response) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Takes the response from Watson Conversation, performs any additional steps
     * that may be required, and returns the reply that should be sent to the user.
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The reply to send to the user if fulfilled, or an error if rejected
     */
    handleResponseFromWatsonConversation(conversationResponse) {
        // In some cases we just return the response defined in Watson Conversation (handled by handleDefaultMessage).
        // In others we need to take special steps to return a customized response.
        // For example, we may need to return the results of a databse lookup or 3rd party API call.
        // Here we look to see if a custom "action" has been configured in Watson Conversation and if we
        // need to return a custom response based on the action.
        const action = conversationResponse.context.action;
        if (action == "findDoctorByLocation") {
             return this.handleXXXMessage(conversationResponse);
        }
        else {
            return this.handleDefaultMessage(conversationResponse);
        }
    }

    /**
     * The default handler for any message from Watson Conversation that requires no additional steps.
     * Returns the reply that was configured in the Watson Conversation dialog.
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The reply to send to the user if fulfilled, or an error if rejected
     */
    handleDefaultMessage(conversationResponse) {
        let reply = '';
        for (let i = 0; i < conversationResponse.output.text.length; i++) {
            reply += conversationResponse.output.text[i] + '\n';
        }
        return Promise.resolve(reply);
    }

    /**
     * Returns a custom response to the user.
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The reply to send to the user if fulfilled, or an error if rejected
     */
    handleXXXMessage(conversationResponse) {
        var location = conversationResponse.entities[0].value;
        var replyStart = 'Here is a list of 5 hospitals with the shortest average wait time in ' + location + ':\n';
        var replyEnd = '';
        // Read hospitals.csv:
        return new Promise((resolve, reject) => {
            fs.readFile('/Users/Gladys/healthaide/node/hospitals.csv', 'utf8', function (err, input) {
              if (err) return reject(err);
              let output = parse(input, {columns: true});
              //sort by wait time:
              output = output.filter(function(a){return a['wait_time'] !== 'N/A'});

              output.sort(function(a,b){return Number(a['wait_time']) - Number(b['wait_time'])});

              for (var i = 0; i < 5; i++) {

                replyEnd += output[i].name +', ADDRESS: ' + output[i].address + ', AVG WAIT TIME(MIN): ' + output[i]['wait_time'] + ', AVG DISCHARGE TIME(MIN): ' + output[i]['time_until_sent_home'] +  '\n';
                }
                return resolve(replyStart + replyEnd);
            })
        });
    }
}

module.exports = MyBot;