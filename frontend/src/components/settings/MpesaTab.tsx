import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useMpesaSettings, useUpdateMpesaSettings } from '../../hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Smartphone } from 'lucide-react';

function Skeletons({ n }: { n: number }) {
  return <div className="space-y-2">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
}

export default function MpesaTab() {
  const { data: settings, isLoading } = useMpesaSettings();
  const updateSettings = useUpdateMpesaSettings();
  const [shortcode, setShortcode] = useState('');
  const [initiator, setInitiator] = useState('');

  useEffect(() => {
    if (settings) {
      setShortcode(settings.shortcode);
      setInitiator(settings.initiator_name);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ shortcode, initiator_name: initiator });
      toast.success('M-Pesa settings saved');
    } catch { toast.error('Failed to save M-Pesa settings'); }
  };

  if (isLoading) return <Skeletons n={4} />;

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" /> M-Pesa Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Shortcode</label>
            <Input value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="Business paybill / till number" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Initiator Name</label>
            <Input value={initiator} onChange={(e) => setInitiator(e.target.value)} placeholder="B2C initiator username" />
          </div>

          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Settings
          </Button>
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <Badge variant={settings.environment === 'production' ? 'default' : 'secondary'}>{settings.environment}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consumer Key</span>
              <Badge variant={settings.consumer_key_set ? 'default' : 'destructive'}>{settings.consumer_key_set ? 'Set' : 'Not set'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consumer Secret</span>
              <Badge variant={settings.consumer_secret_set ? 'default' : 'destructive'}>{settings.consumer_secret_set ? 'Set' : 'Not set'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Security Credential</span>
              <Badge variant={settings.security_credential_set ? 'default' : 'destructive'}>{settings.security_credential_set ? 'Set' : 'Not set'}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
