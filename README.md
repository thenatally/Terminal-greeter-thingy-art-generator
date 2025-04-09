run inline bc node art.js wont do anything

art.js \<input-file.txt\> [--fg \<color\>] [--bg \<color\>] [--fmt \<style\>] [--multi] [--pride fg|bg \<flag\>] [--pride-orient horiz|vert] [--end fade|triangle|saw]

.hitally.txt and .hitally.sh are examples

\<color\> accepts black,red,green,yellow,blue,purple,magenta,cyan,white,hex(#nnnnnn),rgb(n, n, n) or hsl(n, n, n)

example output:

![image](https://github.com/user-attachments/assets/31734aca-bfd2-4d4c-87bb-3489dfbfb77f)

generated with:

`art.js .hitally.txt --multi --fmt bold --pride fg lesbian --pride-orient vert --bg "rgb(15,15,15)" --end fade`

for --multi every segment needs to be seperated by 3 or more empty lines, i pulled this number from nowhere just deal with
