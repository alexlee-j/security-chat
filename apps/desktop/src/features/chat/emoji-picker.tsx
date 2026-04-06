import data from '@emoji-mart/data';
import { Picker } from '@emoji-mart/react';

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPicker(props: EmojiPickerProps): JSX.Element {
  return (
    <div className="emoji-picker-container">
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => {
          props.onSelect(emoji.native);
        }}
        theme="light"
        previewPosition="none"
        skinTonePosition="preview"
      />
    </div>
  );
}
