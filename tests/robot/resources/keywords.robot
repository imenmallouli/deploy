*** Settings ***
Library    Collections
Library    DateTime
Library    RequestsLibrary

Resource   variables.robot

*** Keywords ***
Create API Session
    Create Session    backend    ${BASE_URL}

Get Unique Email
    ${timestamp}=    Get Current Date    result_format=%Y%m%d%H%M%S%f
    ${email}=    Set Variable    robot_${timestamp}@example.com
    RETURN    ${email}

Ensure Database Ready
    ${resp}=    POST On Session    backend    ${API_PREFIX}/create-tables
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data}=    Set Variable    ${resp.json()}
    Dictionary Should Contain Key    ${data}    status

Register User
    [Arguments]    ${email}    ${role}=admin
    ${payload}=    Create Dictionary
    ...    first_name=Robot
    ...    last_name=Framework
    ...    email=${email}
    ...    role=${role}
    ...    phone=${DEFAULT_PHONE}
    ...    password=${DEFAULT_PASSWORD}
    ${resp}=    POST On Session    backend    ${API_PREFIX}/auth/register    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    RETURN    ${resp}

Login User
    [Arguments]    ${email}
    ${payload}=    Create Dictionary    email=${email}    password=${DEFAULT_PASSWORD}
    ${resp}=    POST On Session    backend    ${API_PREFIX}/auth/login    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    RETURN    ${resp}

Get Me
    [Arguments]    ${access_token}
    ${headers}=    Create Dictionary    Authorization=Bearer ${access_token}
    ${resp}=    GET On Session    backend    ${API_PREFIX}/auth/me    headers=${headers}
    Should Be Equal As Integers    ${resp.status_code}    200
    RETURN    ${resp}
