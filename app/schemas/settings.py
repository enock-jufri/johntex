from pydantic import BaseModel


class SettingBase(BaseModel):
    key: str
    value: str


class SettingCreate(SettingBase):
    pass


class SettingRead(SettingBase):
    pass
