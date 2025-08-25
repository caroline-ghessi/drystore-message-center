-- Execute the cleanup function to remove invalid messages from queue
SELECT * FROM cleanup_invalid_queue_messages();