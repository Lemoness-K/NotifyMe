# AI-DLC review site

This Jekyll source is deployed to GitHub Pages from the ai-dlc-review-site branch.
The publishing helper copies only the explicitly selected stage artifacts into
reviews/, adds a row to _data/reviews.json, and pushes that branch. Audit logs,
stage memory, and runtime state are not review-page content.
