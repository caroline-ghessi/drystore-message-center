-- Enable Row Level Security and add policies for views to protect customer data

-- Enable RLS on conversations_with_last_message view
ALTER VIEW conversations_with_last_message ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for conversations_with_last_message to only allow authenticated users
CREATE POLICY "Enable all for authenticated users on conversations_with_last_message" 
ON conversations_with_last_message 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Enable RLS on seller_dashboard view  
ALTER VIEW seller_dashboard ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for seller_dashboard to only allow authenticated users
CREATE POLICY "Enable all for authenticated users on seller_dashboard"
ON seller_dashboard
FOR SELECT 
USING (auth.uid() IS NOT NULL);