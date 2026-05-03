import data from '@emoji-mart/data';
import zhI18n from '@emoji-mart/data/i18n/zh.json';
import Picker from '@emoji-mart/react';

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPicker(props: EmojiPickerProps): JSX.Element {
  return (
    <div className="emoji-picker-container">
      <Picker
        data={data}
        i18n={zhI18n}
        onEmojiSelect={(emoji: { native: string }) => {
          props.onSelect(emoji.native);
        }}
        theme="light"
        previewPosition="none"
        skinTonePosition="preview"
        locale="zh"
      />
    </div>
  );
}
