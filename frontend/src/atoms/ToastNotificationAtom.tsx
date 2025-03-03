import { atom } from 'recoil'

type ToastNotification = {
    message : string;
    colour : string;
    visible : boolean
}

export const ToastNotificationAtom = atom<ToastNotification>({
    key : "toastnotificationatom",
    default : {
        message : "hii mrityunjay",
        colour : "",
        visible : false
    }
})