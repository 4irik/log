<?php

require_once 'TestableClass.php';

class TestPhpunit10Native extends PHPUnit\Framework\TestCase
{
    /**
     * Ожидается ошибка/Expected error:
     * ```
     * 1) TestPhpunit10Native::testDoSomethingInvokingGreaterThanOnceFail
     * TestableClass::doSomething(2, '3'): string was not expected to be called more than once.
     * ```
     */
    public function testDoSomethingInvokingGreaterThanOnceFail()
    {
        $testableClass = $this->createMock(TestableClass::class);
        $testableClass->expects($invokedCount = $this->once())
            ->method('doSomething')
            ->willReturnCallback(function (...$parameters) use ($invokedCount) {
                if ($invokedCount->numberOfInvocations() === 1) {
                    $this->assertSame([1, '2'], $parameters);
                    return '1 2';
                }
            });
    
        $this->assertEquals('1 2', $testableClass->doSomething(1, '2'));
        $testableClass->doSomething(2, '3');
    }

    public function testDoSomethingConsecutive()
    {
        $testableClass = $this->createMock(TestableClass::class);
        $testableClass->expects($invokedCount = $this->exactly(2))
            ->method('doSomethingWithDefault')
            ->willReturnCallback(function (...$parameters) use ($invokedCount) {
                if ($invokedCount->numberOfInvocations() === 1) {
                    $this->assertSame([1, '3'], $parameters);
                    return '1 3';
                }
        
                if ($invokedCount->numberOfInvocations() === 2) {
                    $this->assertSame([3, '2'], $parameters);
                    return '3 2';
                }
            });

        $this->assertEquals('1 3', $testableClass->doSomethingWithDefault(1, '3'));
        $this->assertEquals('3 2', $testableClass->doSomethingWithDefault(3));
    }

    public function testDoSomethingConsecutivePartial()
    {
        $testableClass = $this->createMock(TestableClass::class);
        $testableClass->expects($invokedCount = $this->any())
            ->method('doSomethingWithDefault')
            ->willReturnCallback(function (...$parameters) use ($invokedCount) {
                if ($invokedCount->numberOfInvocations() === 1) {
                    $this->assertSame([1, '3'], $parameters);
                    return '1 3';
                }
        
                if ($invokedCount->numberOfInvocations() === 3) {
                    $this->assertSame([3, '2'], $parameters);
                    return '3 2';
                }

                return '';
            });

        $this->assertEquals('1 3', $testableClass->doSomethingWithDefault(1, '3'));
        $this->assertEquals('', $testableClass->doSomethingWithDefault(2));
        $this->assertEquals('3 2', $testableClass->doSomethingWithDefault(3));
        $this->assertEquals('', $testableClass->doSomethingWithDefault(4));
        $this->assertEquals('', $testableClass->doSomethingWithDefault(5));
    }
}