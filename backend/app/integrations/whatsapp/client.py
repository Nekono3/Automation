"""Explicit provider + account selection. A transport failure never changes accounts."""
from typing import Optional
import httpx
from app.config import settings

class WhatsAppClient:
    def __init__(self,access_token:Optional[str]=None,phone_number_id:Optional[str]=None):
        self.access_token=access_token or settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id=phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID

    async def send_text_message(self,to_phone:str,text:str,preview_url:bool=False,account_id:Optional[str]=None):
        if not account_id: return {'error':'explicit_account_required'}
        clean_phone=to_phone.replace('+','').replace(' ','').replace('-','')
        if account_id.startswith('cloud:'):
            if account_id != f'cloud:{self.phone_number_id}' or not self.access_token:
                return {'error':'cloud_account_not_configured'}
            url=f'https://graph.facebook.com/v21.0/{self.phone_number_id}/messages'
            headers={'Authorization':f'Bearer {self.access_token}'}
            payload={'messaging_product':'whatsapp','to':clean_phone,'type':'text','text':{'preview_url':preview_url,'body':text}}
        else:
            if not settings.BRIDGE_API_TOKEN: return {'error':'bridge_not_configured'}
            url=f'{settings.BRIDGE_URL}/send'
            headers={'Authorization':f'Bearer {settings.BRIDGE_API_TOKEN}'}
            payload={'account_id':account_id,'to':clean_phone,'text':text}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response=await client.post(url,json=payload,headers=headers)
                if response.status_code!=200: return {'error':'provider_rejected','status_code':response.status_code}
                result=response.json()
                if not account_id.startswith('cloud:') and result.get('session_id')!=account_id:
                    return {'error':'provider_account_mismatch'}
                return result
        except (httpx.HTTPError,ValueError):
            return {'error':'provider_unavailable'}
