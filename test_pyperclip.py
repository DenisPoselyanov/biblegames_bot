import tkinter as tk
try:
    import pyperclip
    print("pyperclip imported successfully")
except ImportError:
    print("pyperclip not available")
    pyperclip = None

def test_clipboard():
    root = tk.Tk()
    root.title("Pyperclip Test")

    def copy_with_pyperclip():
        text = text_widget.get("1.0", "end-1c")
        try:
            if pyperclip:
                pyperclip.copy(text)
                status_var.set("Copied with pyperclip!")
            else:
                status_var.set("pyperclip not available")
        except Exception as e:
            status_var.set(f"Error: {e}")

    def copy_with_tkinter():
        text = text_widget.get("1.0", "end-1c")
        try:
            root.clipboard_clear()
            root.clipboard_append(text)
            try:
                root.clipboard_update()
                status_var.set("Copied with tkinter clipboard_update!")
            except:
                root.update()
                status_var.set("Copied with tkinter update!")
        except Exception as e:
            status_var.set(f"Error: {e}")

    text_widget = tk.Text(root, height=10, width=50)
    text_widget.pack(pady=10)
    text_widget.insert("1.0", "Test text to copy\nTry both copy methods")

    btn1 = tk.Button(root, text="Copy with pyperclip", command=copy_with_pyperclip)
    btn1.pack(pady=5)

    btn2 = tk.Button(root, text="Copy with tkinter", command=copy_with_tkinter)
    btn2.pack(pady=5)

    status_var = tk.StringVar(value="Ready")
    status = tk.Label(root, textvariable=status_var)
    status.pack(pady=5)

    root.mainloop()

if __name__ == "__main__":
    test_clipboard()
