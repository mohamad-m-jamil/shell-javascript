const { exit } = require("process");
const readline = require("readline");
const { text } = require("stream/consumers");
const fs = require("fs");
const path = require("path");
const { spawnSync, exec } = require('child_process');

//node app/main.js

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const builtins = ["echo", "exit"];
    const hitsList = builtins.filter(c => c.startsWith(line)).map(h => h + " ");
    if (hitsList.length > 0)
      return [hitsList, line];
    else
      return [builtins.map(b => b + " "), line];
  }
});


function handleExit(answer)
{
  if (answer === "exit 0")
    process.exit(0);
}

function handleEcho(answer)
{
  if (answer.startsWith("echo ")) {
    const text = answer.slice(5);
    let i = 0;
    let qut = false;
    let dubleQut = false;
    while(i < text.length)
    {
      if(text[i] === "'" && !dubleQut)
      {
        qut = !qut;
        i++;
        continue;
      }
      if(text[i] === "\"" && !qut)
      {
        dubleQut = !dubleQut;
        i++;
        continue;
      }
      if(!qut && text[i] === " ")
      {
        while(text[i] === " ") i++;
        process.stdout.write(" ");
        continue;
      }
      if(!dubleQut && text[i] === " ")
      {
        while(text[i] === " ") i++;
        process.stdout.write(" ");
        continue;
      }
      if(text[i] === '\\' && dubleQut)
      {
        i++;
        continue;
      }
      if(text[i] === '\\' && !qut && !dubleQut)
      {
        while(text[i] === '\\')
        {
          process.stdout.write(" ");
          i++;
        }
        continue;
      }
      process.stdout.write(text[i]);
      i++;
    }
    process.stdout.write("\n");
    return true;
  }
  return false;
}

function handlePwd(answer) 
{
  if (answer === "pwd") {
    const pwd_p = process.cwd();
    if (!pwd_p)
      console.log("Error pwd not found!");
    else
      console.log(pwd_p);
    return true;
  }
  return false;
}

function handleType(answer)
{
  if (answer.startsWith("type ")) {
    const text = answer.slice(5);
    if (text === "exit" || text === "echo" || text === "type" || text === "pwd")
      console.log(text + " is a shell builtin");
    else {
      let found = false;
      const pathdr = process.env.PATH.split(":");
      for (const dir of pathdr) {
        const filePath = `${dir}/${text}`;
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          console.log(`${text} is ${filePath}`);
          found = true;
          break;
        }
      }
      if (!found) console.log(text + ": not found");
    }
    return true;
  }
  return false;
}

function parseCommandLine(text) {
  const args = [];
  let i = 0;
  let current = "";
  let singleQ = false;
  let doubleQ = false;

  while (i < text.length) {
    const char = text[i];

    if (char === "'" && !doubleQ) {
      singleQ = !singleQ;
      i++;
      continue;
    }

    if (char === '"' && !singleQ) {
      doubleQ = !doubleQ;
      i++;
      continue;
    }

    if (char === "\\" && !singleQ) {
      i++;
      if (i < text.length) current += text[i];
      i++;
      continue;
    }

    if (!singleQ && !doubleQ && char === " ") {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      while (text[i] === " ") i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.length > 0) args.push(current);
  return args;
}

function handleExternal(answer)
{
  const args = parseCommandLine(answer);
  const cmd = args.shift();
  const result = spawnSync(cmd, args, { encoding: "utf-8", stdio: "inherit", shell: true });
  if (result.error) console.log(cmd + ": command not found");
}

function handleCd(answer)
{
  const args = answer.trim().split(" ");
  if(args[0] === "cd")
  {
    if(args.length > 2)
      console.log("Error mult args!");
    else if(args.length < 2)
      console.log("Error one arg!");
    else if(args[1] === "~")
    {
      try
      {
        const homePath = path.resolve(process.env.HOME);
        process.chdir(homePath);
      }
      catch
      {
        console.log(`cd: ${args[1]}: No such file or directory`);
      }
    }
    else
    {
      try
      {
        const targpath = path.resolve(args[1]);
        process.chdir(targpath);
      }
      catch
      {
        console.log(`cd: ${args[1]}: No such file or directory`);
      }
    }
    return(true);
  }
  return(false);
}

function handleRedirection(answer)
{
  const args = answer.trim().split(" ");
  const cmd = args.shift();
  let i = 0;
  let index;
  let ifrederror = false
  while(i < args.length)
  {
    if(args[i] === "2>")
      ifrederror = true;
    if(args[i] === ">" || args[i] === "1>" || args[i] === "2>")
    {
      index = i + 1;
      break;
    }
    i++;
  }
  const file = args[index];
  if (!file)
  {
    console.log("Error: no file specified for redirection");
    return;
  }
  args.splice(i, 2);
  let fd;
  try
  {
    fd = fs.openSync(file, "w");
  }
  catch
  {
    console.log("error");
    return;
  }
  let result;
  if(ifrederror === true)
    result = spawnSync(cmd, args, { encoding: "utf-8", stdio: ["inherit", "inherit", fd] , shell: true });
  else
    result = spawnSync(cmd, args, { encoding: "utf-8", stdio: ["inherit", fd, "inherit"] , shell: true });
  if (result.error) console.log(cmd + ": command not found");
  fs.closeSync(fd);
}

function handleRedirectionAppending(answer)
{
  const args = answer.trim().split(" ");
  const cmd = args.shift();
  let i = 0;
  let index;
  let ifrederror = false
  while(i < args.length)
  {
    if(args[i] === "2>>")
      ifrederror = true;
    if(args[i] === ">>" || args[i] === "1>>" || args[i] === "2>>")
    {
      index = i + 1;
      break;
    }
    i++;
  }
  const file = args[index];
  if (!file)
  {
    console.log("Error: no file specified for redirection");
    return;
  }
  args.splice(i, 2);
  let fd;
  try
  {
    fd = fs.openSync(file, "a");
  }
  catch
  {
    console.log("error");
    return;
  }
  let result;
  if(ifrederror === true)
    result = spawnSync(cmd, args, { encoding: "utf-8", stdio: ["inherit", "inherit", fd] , shell: true });
  else
    result = spawnSync(cmd, args, { encoding: "utf-8", stdio: ["inherit", fd, "inherit"] , shell: true });
  if (result.error) console.log(cmd + ": command not found");
  fs.closeSync(fd);
}

function promptUser()
{
  rl.question("$ ", (answer) =>
  {
    if (!answer.trim())
      return promptUser();

    handleExit(answer);
    if (answer.includes(">>") || answer.includes("2>>"))
      handleRedirectionAppending(answer);
    else if (answer.includes(">") || answer.includes("1>"))
      handleRedirection(answer);
    else
    {
      if (handleEcho(answer)) return promptUser();
      if (handlePwd(answer)) return promptUser();
      if (handleType(answer)) return promptUser();
      if (handleCd(answer)) return promptUser();

      handleExternal(answer);
    }

    promptUser();
  });
}

promptUser();