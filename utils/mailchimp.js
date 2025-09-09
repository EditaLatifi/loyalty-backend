const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX // e.g. 'us21'
});

async function addToList(email) {
  try {
    await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
      email_address: email,
      status: 'subscribed'
    });
    console.log(`Added ${email} to Mailchimp`);
  } catch (err) {
    console.error('Mailchimp error:', err.message);
  }
}

module.exports = { addToList };
